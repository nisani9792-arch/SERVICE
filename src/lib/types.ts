/** Legacy AI classification buckets (Gemini). Stored as free-form `category` strings in DB. */
export const TICKET_CATEGORIES = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "spam",
  "handled",
  "Customer_Support",
  "Billing",
  "Spam"
] as const;

export type LegacyTicketCategory = (typeof TICKET_CATEGORIES)[number];

/** @deprecated Prefer free-form category strings; kept for legacy components */
export type TicketCategory = LegacyTicketCategory;

export type TicketStatus = "open" | "in_progress" | "closed";

export type TicketSource = "import" | "manual";
export type TicketPriority = 1 | 2 | 3 | 4 | 5;

export interface Ticket {
  id: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  /** Free-form label (historical imports may use values like Customer_Support, Billing, Spam). */
  category: string;
  priority: TicketPriority;
  aiSummary: string;
  status: TicketStatus;
  source: TicketSource;
  tags: string[];
  assignedTo: string;
  /** Business/event timestamp from source data; falls back to createdAt in UI when null. */
  messageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCreateInput {
  senderEmail: string;
  senderName?: string;
  subject: string;
  body: string;
  source: TicketSource;
}

export interface TicketUpdateInput {
  subject?: string;
  body?: string;
  category?: string;
  priority?: TicketPriority;
  aiSummary?: string;
  status?: TicketStatus;
  tags?: string[];
  assignedTo?: string;
}

/** Gemini classifier output (internal buckets). */
export interface GeminiClassification {
  category: Exclude<LegacyTicketCategory, "handled" | "Customer_Support" | "Billing" | "Spam">;
  priority: TicketPriority;
  summary: string;
}

export interface ImportRecordInput {
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  body?: string;
}

export interface ClassifiedImportRecord {
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  category: string;
  priority: TicketPriority;
  summary: string;
}

/** Historical dump shape (JSON import). */
export interface HistoricalTicketJson {
  date?: string;
  sender_name?: string;
  email?: string;
  subject?: string;
  summary?: string;
  category?: string;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReplyTemplate {
  id: string;
  title: string;
  body: string;
  shortcut: string;
  createdAt: string;
}
