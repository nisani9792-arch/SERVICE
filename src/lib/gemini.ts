import { GoogleGenerativeAI } from "@google/generative-ai";
import { bodyForAiPrompt } from "@/lib/message-filter";
import { isLikelySpamInquiry } from "@/lib/spam-inquiry";
import { normalizeCategory } from "@/lib/category-normalize";
import { TicketPriority } from "@/lib/types";

const MODEL_NAME = "gemini-1.5-flash";

export type GeminiClassifyResult = {
  category: string;
  priority: TicketPriority;
  summary: string;
  confidence: number;
  unavailable: boolean;
  /** Short CRM tags (snake_case), max 6 */
  suggestedTags?: string[];
  /** Customer emotional tone */
  sentiment?: "positive" | "neutral" | "negative" | "frustrated";
  /** One Hebrew sentence: how this maps to internal KB / policies */
  kbRoutingHint?: string;
};

const ALLOWED_CATEGORIES = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "Customer_Support",
  "Billing",
  "spam"
] as const;

const SPAM_KEYWORDS = [
  "bitcoin",
  "casino",
  "earn money fast",
  "viagra",
  "adult",
  "click here",
  "guaranteed income",
  "free trial",
  "contact form marketing",
  "automate your income",
  "money-making",
  "expensive ads",
  "ai-driven",
  "earn 35%",
  "visa or mastercard",
  "reputation video",
  "millions of websites",
  "blast your message",
  "funding opportunity",
  "fund your busines",
  "capitalfund",
  "without much funds",
  "are you okay running your business",
  "just visited jusic"
];

const URGENT_KEYWORDS = [
  "urgent",
  "דחוף",
  "לא עובד",
  "תקלה",
  "can't login",
  "cannot login",
  "לא מצליח להתחבר",
  "copyright infringement"
];

const ARTIST_KEYWORDS = [
  "זמר",
  "אמן",
  "להעלות שיר",
  "העלאת שיר",
  "להכניס שירים",
  "פרסום שיר",
  "שיר חדש",
  "סינגל חדש",
  "קישור יוטיוב",
  "קריוקי"
];

const coercePriority = (priority: unknown): TicketPriority => {
  const asNumber = Number(priority);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 5) {
    return asNumber as TicketPriority;
  }
  return 3;
};

const coerceConfidence = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

const extractJsonBlock = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Gemini response does not include JSON block");
  }
  return trimmed.slice(firstBrace, lastBrace + 1);
};

const FEW_SHOT_EXAMPLES = `
Examples (Hebrew/English Jusic CRM):
- "האפליקציה קורסת כשאני מנסה לנגן" → bugs, priority 5
- "איך מבטלים מנוי פרימיום?" → premium, priority 3
- "אני זמר ורוצה להעלות שיר" → artist, priority 3
- "יש שימוש לא מורשה בשיר שלי" → copyright, priority 4
- "הייתי רוצה שתוסיפו פיצ'ר X" → suggestions, priority 2
- "חיוב כפול בכרטיס" → Billing, priority 4
- "שלום, איך נרשמים?" → Customer_Support, priority 3
- "Earn money fast with bitcoin" → spam, priority 1
`;

function buildUnifiedPrompt(senderEmail: string, subject: string, compactBody: string): string {
  return `
You are an email support classifier for Jusic CRM (Hebrew music app).
Classify into exactly one category. Return strict JSON only.

Allowed categories:
- suggestions (feature requests, improvements)
- bugs (app crashes, login failures, playback issues)
- premium (subscription, registration, cancel premium)
- copyright (unauthorized use of songs)
- artist (singer wants to upload/join Jusic)
- Customer_Support (general help, how-to questions)
- Billing (payments, charges, refunds)
- spam (mass marketing, phishing, automated junk ONLY)

Rules:
- Use "spam" ONLY for obvious junk with no real user request.
- Real Hebrew/English user messages are NOT spam.
- priority: integer 1..5 (5 = urgent)
- summary: ONE sentence in Hebrew, max 24 words
- confidence: float 0.0..1.0 (how sure you are)

${FEW_SHOT_EXAMPLES}

Also include (optional but strongly preferred when confident):
- suggestedTags: 2-6 short snake_case tags for CRM routing (e.g. "billing_dispute", "login_error", "upload_help")
- sentiment: one of positive | neutral | negative | frustrated
- kbRoutingHint: one Hebrew sentence describing how this maps to Jusic policies / help-center themes (not verbatim policy text)

Return exactly:
{"category":"Customer_Support","priority":3,"summary":"...","confidence":0.85,"suggestedTags":["..."],"sentiment":"neutral","kbRoutingHint":"..."}

senderEmail: ${senderEmail}
subject: ${subject}
body:
${compactBody}
`;
}

export const quickHeuristic = (
  subject: string,
  body: string
): { category: string; priority: TicketPriority; summary: string } | null => {
  if (isLikelySpamInquiry(subject, body)) {
    return {
      category: "spam",
      priority: 1,
      summary: "ספאם — פנייה ריקה, שיווק, רשימת תפוצה או בדיקת אתר (זיהוי אוטומטי)."
    };
  }

  const text = `${subject} ${body}`.toLowerCase();

  if (SPAM_KEYWORDS.some((word) => text.includes(word))) {
    return {
      category: "spam",
      priority: 1,
      summary: "הודעה זוהתה כספאם על בסיס ביטויי פרסום חשודים."
    };
  }

  if (URGENT_KEYWORDS.some((word) => text.includes(word))) {
    return {
      category: "bugs",
      priority: 5,
      summary: "זוהתה פנייה דחופה בנושא תקלה או השבתת שימוש."
    };
  }

  if (ARTIST_KEYWORDS.some((word) => text.includes(word))) {
    return {
      category: "artist",
      priority: 3,
      summary: "פנייה בנושא שירים, אמנים או העלאת מוזיקה לג׳וזיק."
    };
  }

  return null;
};

export async function classifyWithGemini(
  senderEmail: string,
  subject: string,
  body: string
): Promise<GeminiClassifyResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      category: "suggestions",
      priority: 3,
      summary: "פנייה כללית — סיווג AI לא זמין.",
      confidence: 0,
      unavailable: true
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });

  const compactBody = bodyForAiPrompt(body).trim().slice(0, 8000);
  const prompt = buildUnifiedPrompt(senderEmail, subject, compactBody);

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const parsed = JSON.parse(extractJsonBlock(text)) as {
      category?: string;
      priority?: number;
      summary?: string;
      confidence?: number;
      suggestedTags?: unknown;
      sentiment?: string;
      kbRoutingHint?: string;
    };

    const normalized = normalizeCategory(String(parsed.category ?? "").replace(/\s+/g, "_"));
    const category = ALLOWED_CATEGORIES.includes(
      normalized as (typeof ALLOWED_CATEGORIES)[number]
    )
      ? normalized
      : "Customer_Support";

    const sentiments = new Set(["positive", "neutral", "negative", "frustrated"]);
    const sentiment =
      typeof parsed.sentiment === "string" && sentiments.has(parsed.sentiment)
        ? (parsed.sentiment as GeminiClassifyResult["sentiment"])
        : undefined;

    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags
          .map((t) =>
            String(t)
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_")
              .slice(0, 48)
          )
          .filter((t) => t.length >= 2)
          .slice(0, 6)
      : undefined;

    const kbRoutingHint =
      typeof parsed.kbRoutingHint === "string" && parsed.kbRoutingHint.trim().length > 0
        ? parsed.kbRoutingHint.trim().slice(0, 280)
        : undefined;

    return {
      category,
      priority: coercePriority(parsed.priority),
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : "פנייה כללית שהתקבלה וממתינה לטיפול.",
      confidence: coerceConfidence(parsed.confidence),
      unavailable: false,
      suggestedTags,
      sentiment,
      kbRoutingHint
    };
  } catch {
    return {
      category: "Customer_Support",
      priority: 3,
      summary: "פנייה כללית שהתקבלה וממתינה לטיפול.",
      confidence: 0.3,
      unavailable: false
    };
  }
}

/** @deprecated Use classifyDirect from classification.ts */
export const classifyTicketContent = async (
  senderEmail: string,
  subject: string,
  body: string
) => {
  const heuristic = quickHeuristic(subject, body);
  if (heuristic) {
    return {
      category: normalizeCategory(heuristic.category) as Exclude<
        typeof heuristic.category,
        "Billing" | "Spam" | "handled"
      >,
      priority: heuristic.priority,
      summary: heuristic.summary
    };
  }

  const result = await classifyWithGemini(senderEmail, subject, body);
  return {
    category: result.category as
      | "suggestions"
      | "bugs"
      | "premium"
      | "copyright"
      | "artist"
      | "Customer_Support"
      | "spam",
    priority: result.priority,
    summary: result.summary
  };
};

export type ReclassifyResult = {
  category: string;
  priority: TicketPriority;
  summary: string;
  confidence: number;
  suggestedTags?: string[];
  sentiment?: GeminiClassifyResult["sentiment"];
  kbRoutingHint?: string;
};

export const reclassifyTicketContent = async (
  senderEmail: string,
  subject: string,
  body: string
): Promise<ReclassifyResult> => {
  const heuristic = quickHeuristic(subject, body);
  if (heuristic) {
    return {
      category: normalizeCategory(heuristic.category),
      priority: heuristic.priority,
      summary: heuristic.summary,
      confidence: 1
    };
  }

  const result = await classifyWithGemini(senderEmail, subject, body);
  return {
    category: result.category,
    priority: result.priority,
    summary: result.summary,
    confidence: result.confidence,
    suggestedTags: result.suggestedTags,
    sentiment: result.sentiment,
    kbRoutingHint: result.kbRoutingHint
  };
};
