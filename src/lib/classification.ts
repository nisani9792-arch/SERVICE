import {
  classifyWithGemini,
  quickHeuristic,
  type GeminiClassifyResult
} from "@/lib/gemini";
import { normalizeCategory } from "@/lib/category-normalize";
import { bodyForAiPrompt } from "@/lib/message-filter";
import { isEmptyOrNoiseInquiry } from "@/lib/inquiry-spam-heuristic";
import { isSpamCategory } from "@/lib/spam-category";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
import type { TicketPriority } from "@/lib/types";

export { normalizeCategory, CANONICAL_CATEGORIES } from "@/lib/category-normalize";
export type { CanonicalCategory } from "@/lib/category-normalize";

const AUTO_SPAM_CONFIDENCE = 0.85;
const AUTO_URGENT_PRIORITY = 5 as TicketPriority;

export function isHybridClassifyEnabled(): boolean {
  const flag = process.env.CRM_HYBRID_CLASSIFY?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export type HybridClassification = {
  category: string;
  priority: TicketPriority;
  summary: string;
  status: "open" | "closed";
  aiSuggestedCategory: string | null;
  classificationConfidence: number | null;
  extraTags: string[];
  autoApplied: boolean;
};

function buildPendingSuggestion(
  gemini: GeminiClassifyResult,
  extraTags: string[] = []
): HybridClassification {
  return {
    category: PENDING_TRIAGE_CATEGORY,
    priority: gemini.priority,
    summary: gemini.summary,
    status: "open",
    aiSuggestedCategory: normalizeCategory(gemini.category),
    classificationConfidence: gemini.confidence,
    extraTags,
    autoApplied: false
  };
}

function buildAutoApplied(
  category: string,
  priority: TicketPriority,
  summary: string,
  status: "open" | "closed",
  confidence: number | null
): HybridClassification {
  return {
    category: normalizeCategory(category),
    priority,
    summary,
    status,
    aiSuggestedCategory: null,
    classificationConfidence: confidence,
    extraTags: [],
    autoApplied: true
  };
}

export async function classifyHybrid(
  senderEmail: string,
  subject: string,
  body: string
): Promise<HybridClassification> {
  if (!isHybridClassifyEnabled()) {
    return {
      category: PENDING_TRIAGE_CATEGORY,
      priority: 3,
      summary: "פנייה חדשה ממתינה לסינון ידני.",
      status: "open",
      aiSuggestedCategory: null,
      classificationConfidence: null,
      extraTags: [],
      autoApplied: false
    };
  }

  const aiBody = bodyForAiPrompt(body);

  if (isEmptyOrNoiseInquiry(subject, aiBody)) {
    return buildAutoApplied(
      "spam",
      1,
      "פנייה ריקה או ללא תוכן משמעותי — סווגה כספאם.",
      "closed",
      1
    );
  }

  const heuristic = quickHeuristic(subject, aiBody);
  if (heuristic?.category === "spam") {
    return buildAutoApplied("spam", 1, heuristic.summary, "closed", 1);
  }
  if (heuristic?.category === "bugs" && heuristic.priority >= AUTO_URGENT_PRIORITY) {
    return buildAutoApplied("bugs", heuristic.priority, heuristic.summary, "open", 1);
  }

  const gemini = await classifyWithGemini(senderEmail, subject, aiBody);

  if (gemini.unavailable) {
    return {
      category: PENDING_TRIAGE_CATEGORY,
      priority: 3,
      summary: "פנייה חדשה — סיווג AI לא זמין.",
      status: "open",
      aiSuggestedCategory: null,
      classificationConfidence: null,
      extraTags: ["AI_UNAVAILABLE"],
      autoApplied: false
    };
  }

  const normalized = normalizeCategory(gemini.category);
  const isSpam = isSpamCategory(normalized);
  const isUrgent = gemini.priority >= AUTO_URGENT_PRIORITY && normalized === "bugs";

  if (isSpam && gemini.confidence >= AUTO_SPAM_CONFIDENCE) {
    return buildAutoApplied("spam", 1, gemini.summary, "closed", gemini.confidence);
  }

  if (isUrgent) {
    return buildAutoApplied("bugs", gemini.priority, gemini.summary, "open", gemini.confidence);
  }

  return buildPendingSuggestion(gemini);
}

export async function classifyDirect(
  senderEmail: string,
  subject: string,
  body: string
): Promise<GeminiClassifyResult> {
  const aiBody = bodyForAiPrompt(body);
  const heuristic = quickHeuristic(subject, aiBody);
  if (heuristic) {
    return {
      category: normalizeCategory(heuristic.category),
      priority: heuristic.priority,
      summary: heuristic.summary,
      confidence: 1,
      unavailable: false
    };
  }
  const result = await classifyWithGemini(senderEmail, subject, aiBody);
  return {
    ...result,
    category: normalizeCategory(result.category)
  };
}
