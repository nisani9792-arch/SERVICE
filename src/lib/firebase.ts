import { Ticket, TicketUpdateInput } from "@/lib/types";

const API = "/api/tickets";

export const fetchTickets = async (): Promise<Ticket[]> => {
  const res = await fetch(API, { cache: "no-store" });
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

export const updateTicket = async (ticketId: string, input: TicketUpdateInput) => {
  const res = await fetch(`${API}/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error("Failed to update ticket");
};

export const deleteTicket = async (ticketId: string) => {
  const res = await fetch(`${API}/${ticketId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete ticket");
};

export const updateTicketsBulk = async (
  ticketIds: string[],
  input: TicketUpdateInput
) => {
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
