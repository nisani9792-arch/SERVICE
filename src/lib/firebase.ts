import type {
  HistoricalTicketJson,
  SavedInquiry,
  SavedInquiryStatus,
  Ticket,
  TicketListResponse,
  TicketUpdateInput
} from "@/lib/types";

const API = "/api/tickets";

export const fetchTickets = async (): Promise<Ticket[]> => {
  const res = await fetch(`${API}?pageSize=5000`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tickets");
  const data = (await res.json()) as TicketListResponse;
  return data.items;
};

export type TicketListQuery = {
  page?: number;
  pageSize?: number;
  category?: string | "all";
  status?: string | "all";
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  q?: string;
  email?: string;
};

export const fetchTicketPage = async (query: TicketListQuery): Promise<TicketListResponse> => {
  const sp = new URLSearchParams();
  sp.set("page", String(query.page ?? 1));
  sp.set("pageSize", String(query.pageSize ?? 25));
  if (query.category && query.category !== "all") sp.set("category", query.category);
  if (query.status && query.status !== "all") sp.set("status", query.status);
  if (query.dateFrom) sp.set("dateFrom", query.dateFrom);
  if (query.dateTo) sp.set("dateTo", query.dateTo);
  if (query.tags?.length) sp.set("tags", query.tags.join(","));
  if (query.q?.trim()) sp.set("q", query.q.trim());
  if (query.email) sp.set("email", query.email);

  const res = await fetch(`${API}?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
};

export const createTicket = async (input: {
  senderEmail: string;
  senderName?: string;
  subject: string;
  body: string;
  source: string;
}) => {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error("Failed to create ticket");
  return res.json();
};

export const createTicketsBulk = async (
  records: {
    senderEmail: string;
    senderName: string;
    subject: string;
    body: string;
    category: string;
    priority: number;
    summary: string;
    status?: string;
    messageAt?: string | null;
  }[]
) => {
  if (records.length === 0) return;
  const res = await fetch(`${API}/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records })
  });
  if (!res.ok) throw new Error("Failed to bulk-create tickets");
};

/** Chunked structured historical import (no AI). */
export const importHistoricalRecords = async (
  records: HistoricalTicketJson[],
  chunkSize = 400,
  onProgress?: (done: number, total: number) => void
) => {
  let inserted = 0;
  const total = records.length;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const res = await fetch("/api/import", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: chunk })
    });
    if (!res.ok) throw new Error(`Historical import failed (${res.status})`);
    const payload = (await res.json()) as { inserted?: number };
    inserted += payload.inserted ?? chunk.length;
    onProgress?.(inserted, total);
  }
  return inserted;
};

export const updateTicket = async (ticketId: string, input: TicketUpdateInput) => {
  const res = await fetch(`${API}/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error("Failed to update ticket");
};

export const sendTicketReply = async (ticketId: string, message: string) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);
  const res = await fetch(`${API}/${ticketId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal: controller.signal
  }).finally(() => window.clearTimeout(timeout));

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      details?: string;
      error?: string;
      step?: string;
    } | null;
    const step = data?.step ? `[${data.step}] ` : "";
    throw new Error(`${step}${data?.details || data?.error || "Failed to send reply"}`);
  }
};

export const deleteTicket = async (ticketId: string) => {
  const res = await fetch(`${API}/${ticketId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete ticket");
};

export type BulkPatchInput = TicketUpdateInput & {
  tags?: string[];
  replaceTags?: boolean;
};

export const updateTicketsBulk = async (ticketIds: string[], input: BulkPatchInput) => {
  const res = await fetch(`${API}/bulk`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ticketIds, ...input })
  });
  if (!res.ok) throw new Error("Failed to bulk update");
};

export const deleteTicketsBulk = async (ticketIds: string[]) => {
  const res = await fetch(`${API}/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ticketIds })
  });
  if (!res.ok) throw new Error("Failed to bulk delete");
};

export const exportContactsUrl = (category?: string | "all") => {
  const sp = new URLSearchParams();
  if (category && category !== "all") sp.set("category", category);
  const q = sp.toString();
  return `/api/export/contacts${q ? `?${q}` : ""}`;
};

const SAVED_API = "/api/saved-inquiries";

export const fetchSavedInquiries = async (): Promise<SavedInquiry[]> => {
  const res = await fetch(SAVED_API, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch saved inquiries");
  const data = (await res.json()) as { items: SavedInquiry[] };
  return data.items;
};

export const saveInquiryForAction = async (ticket: Ticket) => {
  const res = await fetch(SAVED_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketId: ticket.id,
      title: ticket.subject,
      content: ticket.aiSummary || ticket.body || ticket.subject,
      sourceEmail: ticket.senderEmail
    })
  });
  if (!res.ok) throw new Error("Failed to save inquiry");
};

export const updateSavedInquiry = async (
  id: string,
  input: Partial<Pick<SavedInquiry, "title" | "content" | "note">> & {
    status?: SavedInquiryStatus;
  }
) => {
  const res = await fetch(SAVED_API, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...input })
  });
  if (!res.ok) throw new Error("Failed to update saved inquiry");
};

export const deleteSavedInquiry = async (id: string) => {
  const res = await fetch(`${SAVED_API}?${new URLSearchParams({ id }).toString()}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete saved inquiry");
};
