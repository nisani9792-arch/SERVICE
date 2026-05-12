export const TICKET_CATEGORIES = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "spam",
  "handled"
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = "open" | "handled";
export type TicketSource = "import" | "manual";
export type TicketPriority = 1 | 2 | 3 | 4 | 5;

export interface Ticket {
  id: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  category: TicketCategory;
  priority: TicketPriority;
  aiSummary: string;
  status: TicketStatus;
  source: TicketSource;
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
  category?: TicketCategory;
  priority?: TicketPriority;
  aiSummary?: string;
  status?: TicketStatus;
}

export interface GeminiClassification {
  category: Exclude<TicketCategory, "handled">;
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
  category: Exclude<TicketCategory, "handled">;
  priority: TicketPriority;
  summary: string;
}
