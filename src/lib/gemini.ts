import { GoogleGenerativeAI } from "@google/generative-ai";
import { bodyForAiPrompt } from "@/lib/message-filter";
import { GeminiClassification, TicketPriority } from "@/lib/types";

const MODEL_NAME = "gemini-1.5-flash";

const DEFAULT_RESULT: GeminiClassification = {
  category: "suggestions",
  priority: 3,
  summary: "פנייה כללית שהתקבלה וממתינה לטיפול."
};

const ALLOWED_CATEGORIES = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "Customer_Support",
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
  "blast your message"
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

const SUPPORT_KEYWORDS = [
  "איך נכנסים",
  "איך אפשר",
  "מתי",
  "צור קשר",
  "צרו קשר",
  "חזרו אלי",
  "חזרו אליי",
  "שלום",
  "בדיקה",
  "לאיפה המייל",
  "שירות"
];

const coercePriority = (priority: unknown): TicketPriority => {
  const asNumber = Number(priority);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 5) {
    return asNumber as TicketPriority;
  }
  return 3;
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

const quickHeuristic = (subject: string, body: string): GeminiClassification | null => {
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

  if (SUPPORT_KEYWORDS.some((word) => text.includes(word))) {
    return {
      category: "Customer_Support",
      priority: 3,
      summary: "פניית שירות לקוחות כללית למיון וטיפול."
    };
  }

  return null;
};

export const classifyTicketContent = async (
  senderEmail: string,
  subject: string,
  body: string
): Promise<GeminiClassification> => {
  const heuristic = quickHeuristic(subject, body);
  if (heuristic) {
    return heuristic;
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return DEFAULT_RESULT;
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

  const prompt = `
You are an email support classifier for Jusic CRM.
Classify the message into exactly one category and return strict JSON only.

Allowed categories:
- suggestions
- bugs
- premium
- copyright
- artist
- Customer_Support
- spam

Rules:
- priority is integer 1..5 (5 = urgent)
- summary is ONE sentence, maximum 24 words.
- no markdown, no explanation, no extra keys.

Return exactly:
{"category":"suggestions","priority":3,"summary":"..."}

Email metadata:
senderEmail: ${senderEmail}
subject: ${subject}
body:
${compactBody}
`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const parsed = JSON.parse(extractJsonBlock(text)) as {
      category?: string;
      priority?: number;
      summary?: string;
    };

    const category = ALLOWED_CATEGORIES.includes(
      parsed.category as (typeof ALLOWED_CATEGORIES)[number]
    )
      ? (parsed.category as GeminiClassification["category"])
      : DEFAULT_RESULT.category;

    return {
      category,
      priority: coercePriority(parsed.priority),
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : DEFAULT_RESULT.summary
    };
  } catch {
    return DEFAULT_RESULT;
  }
};

const RECLASSIFY_CATEGORIES = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "Customer_Support",
  "Billing",
  "spam"
] as const;

/** Conservative re-check — avoids marking real customers as spam. */
export type ReclassifyResult = {
  category: string;
  priority: TicketPriority;
  summary: string;
};

export const reclassifyTicketContent = async (
  senderEmail: string,
  subject: string,
  body: string
): Promise<ReclassifyResult> => {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return classifyTicketContent(senderEmail, subject, body);
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
  const prompt = `
You are re-reviewing a Jusic CRM ticket that may have been wrongly marked as spam.
Classify again into exactly one category. Return strict JSON only.

Allowed categories:
- suggestions
- bugs
- premium
- copyright
- artist
- Customer_Support
- Billing
- spam

Rules:
- Use "spam" ONLY for obvious mass marketing, phishing, or automated junk with no real user request.
- Real questions, support requests, artists, billing, and Hebrew/English user messages are NOT spam — use Customer_Support or a specific category.
- priority integer 1..5 (5 = urgent)
- summary: one sentence, max 24 words

Return exactly:
{"category":"Customer_Support","priority":3,"summary":"..."}

senderEmail: ${senderEmail}
subject: ${subject}
body:
${compactBody}
`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const parsed = JSON.parse(extractJsonBlock(text)) as {
      category?: string;
      priority?: number;
      summary?: string;
    };

    const normalized = String(parsed.category ?? "")
      .trim()
      .replace(/\s+/g, "_");
    const category = RECLASSIFY_CATEGORIES.includes(
      normalized as (typeof RECLASSIFY_CATEGORIES)[number]
    )
      ? normalized
      : "Customer_Support";

    return {
      category,
      priority: coercePriority(parsed.priority),
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : DEFAULT_RESULT.summary
    };
  } catch {
    return {
      category: "Customer_Support",
      priority: 3,
      summary: "פנייה שנבדקה מחדש וממתינה לטיפול."
    };
  }
};
