import type { TicketListFilters } from "@/lib/ticket-filters";

/** List queries with an explicit bucket use the PostgreSQL view natively. */
export function ticketListFromBucketView(filters: TicketListFilters): boolean {
  return !filters.trashOnly;
}