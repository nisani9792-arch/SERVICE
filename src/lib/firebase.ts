import type {
  HistoricalTicketJson,
  SavedInquiry,
  SavedInquiryStatus,
  Ticket,
  TicketListResponse,
  TicketUpdateInput
} from "@/lib/types";

const API = "/api/tickets";
const FETCH_INIT: RequestInit = { cache: "no-store", credentials: "same-origin" };

export const fetchTicketById = async (ticketId: string, signal?: AbortSignal): Promise<Ticket> => {
  const res = await fetch(`${API}/${ticketId}`, { ...FETCH_INIT, signal });
  if (!res.ok) throw new Error("Failed to fetch ticket");
  return res.json() as Promise<Ticket>;
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
  queue?: "triage";
  sort?: "triage";
};

export const fetchTicketPage = async (
  query: TicketListQuery,
  signal?: AbortSignal
): Promise<TicketListResponse> => {
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
  if (query.queue) sp.set("queue", query.queue);
  if (query.sort) sp.set("sort", query.sort);

  const res = await fetch(`${API}?${sp.toString()}`, { ...FETCH_INIT, signal });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
    throw new Error(data?.details || data?.error || "Failed to fetch tickets");
  }
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

export const updateTicket = async (
  ticketId: string,
  input: TicketUpdateInput
): Promise<Ticket> => {
  const res = await fetch(`${API}/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error("Failed to update ticket");
  return res.json() as Promise<Ticket>;
};

export const reclassifyTickets = async (
  scope: "spam" | "pending_triage" | "ids",
  limit = 25,
  ids?: string[]
) => {
  const res = await fetch("/api/tickets/reclassify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, limit, ids })
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
    throw new Error(data?.details || data?.error || "Reclassify failed");
  }
  return res.json() as Promise<{
    ok: boolean;
    scanned: number;
    updated: number;
    results: Array<{ id: string; from: string; to: string; summary: string }>;
  }>;
};

export type BatchReclassifyResponse = {
  ok: boolean;
  jobId: string | null;
  status: string;
  total: number;
  processed: number;
  done: boolean;
  chunkUpdated: number;
  tokenEstimate?: number;
  results: Array<{ id: string; from: string; to: string; summary: string }>;
  error?: string;
  hint?: string;
};

/** Chunked reclassify — call until `done` is true (poll with jobId between chunks). */
export const reclassifyTicketsBatch = async (
  scope: "spam" | "pending_triage" | "ids",
  options?: { limit?: number; ids?: string[]; chunkSize?: number; jobId?: string }
): Promise<BatchReclassifyResponse> => {
  const res = await fetch("/api/tickets/reclassify/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      limit: options?.limit ?? 100,
      ids: options?.ids,
      chunkSize: options?.chunkSize ?? 25,
      jobId: options?.jobId
    })
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
    throw new Error(data?.details || data?.error || "Batch reclassify failed");
  }
  return res.json() as Promise<BatchReclassifyResponse>;
};

export const getReclassifyBatchStatus = async (jobId: string) => {
  const res = await fetch(`/api/tickets/reclassify/batch/${jobId}`);
  if (!res.ok) throw new Error("Failed to load batch job status");
  return res.json() as Promise<BatchReclassifyResponse & { progress: number }>;
};

export type AgentCommandResponse = {
  ok: boolean;
  reply: string;
  tasks: unknown[];
  actions: Array<{ agent: string; ok: boolean; message: string; data?: Record<string, unknown> }>;
  jobId?: string;
};

export const runAgentCommand = async (
  text: string,
  selectedTicketIds?: string[]
): Promise<AgentCommandResponse> => {
  const res = await fetch("/api/ai/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, selectedTicketIds })
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { details?: string; error?: string } | null;
    throw new Error(data?.details || data?.error || "Agent command failed");
  }
  return res.json() as Promise<AgentCommandResponse>;
};

export {
  runBatchReclassifyWithSse,
  runBatchReclassifyWithPolling,
  continueBatchJobWithPolling,
  streamBatchJobWithSse
} from "@/lib/reclassify-sse";
export type { BatchSseProgress, BatchSseComplete } from "@/lib/reclassify-sse";

export type TicketReplyResponse = {
  ok: boolean;
  queued?: boolean;
  sent?: boolean;
  queueId?: string;
  message?: string;
  closed?: boolean;
  closureNote?: string | null;
};

export const sendTicketReply = async (
  ticketId: string,
  message: string,
  options?: { closeAfterSend?: boolean }
): Promise<TicketReplyResponse> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);
  const res = await fetch(`${API}/${ticketId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, closeAfterSend: options?.closeAfterSend }),
    signal: controller.signal
  }).finally(() => window.clearTimeout(timeout));

  const data = (await res.json().catch(() => null)) as TicketReplyResponse & {
    details?: string;
    error?: string;
    step?: string;
  } | null;

  if (!res.ok) {
    const step = data?.step ? `[${data.step}] ` : "";
    throw new Error(`${step}${data?.details || data?.error || "Failed to send reply"}`);
  }

  return data ?? { ok: true };
};

export type BulkReplyResponse = {
  ok: boolean;
  sent: number;
  queued: number;
  failed: Array<{ id: string; error: string }>;
  total: number;
};

export const sendBulkTicketReply = async (
  ids: string[],
  message: string,
  options?: { closeAfterSend?: boolean }
): Promise<BulkReplyResponse> => {
  const res = await fetch(`${API}/bulk-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, message, closeAfterSend: options?.closeAfterSend })
  });
  const data = (await res.json().catch(() => null)) as BulkReplyResponse & {
    details?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.details || data?.error || "Bulk reply failed");
  }
  return data as BulkReplyResponse;
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

export const saveInquiryForAction = async (ticket: Ticket): Promise<SavedInquiry> => {
  const { formatSavedInquiryDocument } = await import("@/lib/saved-inquiry-document");
  const res = await fetch(SAVED_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketId: ticket.id,
      title: (ticket.subject || "פנייה ללא נושא").trim(),
      content: formatSavedInquiryDocument(ticket),
      sourceEmail: ticket.senderEmail
    })
  });
  if (!res.ok) throw new Error("Failed to save inquiry");
  return (await res.json()) as SavedInquiry;
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

export const fetchTrashTickets = async (): Promise<Ticket[]> => {
  const res = await fetch("/api/tickets/trash?pageSize=100", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch trash");
  const data = (await res.json()) as { items: Ticket[] };
  return data.items;
};

export const restoreTrashTickets = async (ids: string[]) => {
  const res = await fetch("/api/tickets/trash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) throw new Error("Failed to restore");
};

export const deleteTrashTicketsPermanent = async (ids: string[]) => {
  const res = await fetch("/api/tickets/trash", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) throw new Error("Failed to permanently delete");
};

export const deleteSavedInquiry = async (id: string) => {
  const res = await fetch(`${SAVED_API}?${new URLSearchParams({ id }).toString()}`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to delete saved inquiry");
};
