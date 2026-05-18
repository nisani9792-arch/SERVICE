import { formatTicketNumber } from "@/lib/ticket-sequence";
import type { SavedInquiry, Ticket } from "@/lib/types";

/** Build a single editable text block when saving a ticket to the insights list. */
export function formatSavedInquiryDocument(ticket: Ticket): string {
  const email = ticket.senderEmail?.trim() || "לא צוין";
  const subject = ticket.subject?.trim() || "(ללא נושא)";
  const body = (ticket.body || ticket.aiSummary || "").trim() || "(אין תוכן)";
  const ticketRef =
    ticket.ticketNumber != null ? formatTicketNumber(ticket.ticketNumber) : "";

  const lines = ["כתובת מייל:", email, "", "נושא:", subject];

  if (ticketRef) {
    lines.push("", "מספר פנייה:", ticketRef);
  }

  lines.push(
    "",
    "────────────────────────────────────────",
    "טקסט הפנייה",
    "────────────────────────────────────────",
    "",
    body
  );

  return lines.join("\n");
}

export function savedInquiryDownloadText(item: SavedInquiry): string {
  const parts = [
    item.title.trim(),
    "═".repeat(48),
    item.content,
    item.note.trim()
      ? ["", "─".repeat(48), "תובנות ידניות", "─".repeat(48), "", item.note.trim()].join("\n")
      : ""
  ].filter(Boolean);

  return parts.join("\n\n");
}

export function downloadSavedInquiryAsFile(item: SavedInquiry): void {
  const safeName =
    item.title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .trim()
      .slice(0, 60) || "פנייה-שמורה";

  const blob = new Blob([`\ufeff${savedInquiryDownloadText(item)}`], {
    type: "text/plain;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeName}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadAllSavedInquiriesAsFile(items: SavedInquiry[]): void {
  const text = items
    .map((item, index) => {
      const header = `מסמך ${index + 1} מתוך ${items.length}`;
      return [header, "═".repeat(48), savedInquiryDownloadText(item)].join("\n");
    })
    .join("\n\n\n");

  const blob = new Blob([`\ufeff${text}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jusic-saved-inquiries-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
