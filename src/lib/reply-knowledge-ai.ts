import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SimilarReplySuggestion } from "@/lib/reply-knowledge";

const MODEL_NAME = "gemini-1.5-flash";

export type InquiryTopicProfile = {
  topics: string[];
  intent: string;
  keywords: string[];
};

function geminiApiKey(): string | null {
  return process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
}

function extractJsonBlock(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON in Gemini response");
  }
  return trimmed.slice(first, last + 1);
}

/** Extract Hebrew/English topic labels and intent from a customer inquiry. */
export async function extractInquiryTopicProfile(
  subject: string,
  inquiryText: string
): Promise<InquiryTopicProfile | null> {
  const apiKey = geminiApiKey();
  if (!apiKey || inquiryText.trim().length < 8) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
  });

  const prompt = `
You analyze customer support inquiries for Jusic (Hebrew music streaming app).
Return strict JSON only.

Fields:
- topics: 2-5 short Hebrew topic labels (e.g. "ביטול מנוי", "שגיאת התחברות", "העלאת שיר")
- intent: one Hebrew sentence describing what the customer wants
- keywords: 5-12 lowercase tokens (Hebrew or English) useful for matching similar past replies

subject: ${subject.slice(0, 200)}
inquiry:
${inquiryText.slice(0, 3500)}
`;

  try {
    const response = await model.generateContent(prompt);
    const parsed = JSON.parse(extractJsonBlock(response.response.text())) as {
      topics?: unknown;
      intent?: unknown;
      keywords?: unknown;
    };

    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.map((t) => String(t).trim()).filter((t) => t.length >= 2).slice(0, 6)
      : [];
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
          .map((k) => String(k).toLowerCase().trim())
          .filter((k) => k.length >= 2)
          .slice(0, 14)
      : [];
    const intent = typeof parsed.intent === "string" ? parsed.intent.trim().slice(0, 200) : "";

    if (topics.length === 0 && keywords.length === 0) return null;
    return { topics, intent, keywords };
  } catch {
    return null;
  }
}

/** Re-rank keyword-matched suggestions by semantic fit (context + topics). */
export async function rankReplySuggestionsWithGemini(
  subject: string,
  inquiryText: string,
  candidates: SimilarReplySuggestion[],
  limit = 5
): Promise<SimilarReplySuggestion[] | null> {
  const apiKey = geminiApiKey();
  if (!apiKey || candidates.length === 0) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { temperature: 0.05, responseMimeType: "application/json" }
  });

  const candidateLines = candidates
    .slice(0, 12)
    .map(
      (c, i) =>
        `[${i}] recurring=${c.recurring} reason="${c.matchReason}" inquiry="${c.inquirySnippet.slice(0, 180)}" reply="${c.replyText.slice(0, 220)}"`
    )
    .join("\n");

  const prompt = `
You help a support agent pick the best past reply for a new inquiry (Jusic CRM, Hebrew).
Rank candidates by semantic relevance (same problem, same intent, same product area).
Ignore superficial word overlap if the intent differs.

Return strict JSON: {"ranked":[0,2,1],"reasons":["...","..."]}
- ranked: indices of candidates, best first, at most ${limit}
- reasons: short Hebrew phrase per ranked item (why it fits)

New inquiry subject: ${subject.slice(0, 200)}
New inquiry body:
${inquiryText.slice(0, 2500)}

Candidates:
${candidateLines}
`;

  try {
    const response = await model.generateContent(prompt);
    const parsed = JSON.parse(extractJsonBlock(response.response.text())) as {
      ranked?: unknown;
      reasons?: unknown;
    };
    const ranked = Array.isArray(parsed.ranked)
      ? parsed.ranked.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < candidates.length)
      : [];
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((r) => String(r).trim()).filter(Boolean)
      : [];

    if (ranked.length === 0) return null;

    const seen = new Set<number>();
    const out: SimilarReplySuggestion[] = [];
    ranked.forEach((idx, pos) => {
      if (seen.has(idx)) return;
      seen.add(idx);
      const base = candidates[idx];
      const aiReason = reasons[pos];
      out.push({
        ...base,
        score: base.score + (12 - pos),
        matchReason: aiReason ? `AI: ${aiReason}` : base.matchReason
      });
    });

    for (let i = 0; i < candidates.length && out.length < limit; i++) {
      if (seen.has(i)) continue;
      out.push(candidates[i]);
    }

    return out.slice(0, limit);
  } catch {
    return null;
  }
}
