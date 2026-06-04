/** Background AI finalize after optimistic close (no blocking UI). */
export function triggerResolveBackgroundAi(ticketId: string, closureNote: string): void {
  void fetch(`/api/tickets/${ticketId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      message: closureNote.trim() || "נסגר ללא מענה נוסף",
      closeOnly: true
    })
  }).catch(() => {
    /* background */
  });
}
