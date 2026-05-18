import { parseTicketNumberQuery } from "@/lib/ticket-sequence";

export type TicketListFilters = {
  categoryFilter: string | null;
  ticketNumberExact: number | null;
  activeStatusFilter: boolean;
  closedStatusFilter: boolean;
  exactStatusFilter: string | null;
  dateFromTs: string | null;
  /** Exclusive upper bound (start of day after selected "עד תאריך"). */
  dateToExclusiveTs: string | null;
  tagList: string[];
  emailExact: string | null;
  like: string | null;
  page: number;
  pageSize: number;
  offset: number;
  excludeSpamFilter: boolean;
  trashOnly: boolean;
};

export function parseTicketListFilters(searchParams: URLSearchParams): TicketListFilters | { error: string } {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25)
  );
  const offset = (page - 1) * pageSize;

  const category = searchParams.get("category");
  const categoryFilter = category && category !== "all" ? category : null;
  const trashOnly = searchParams.get("trash") === "1";
  const excludeSpamFilter =
    !trashOnly &&
    !categoryFilter &&
    searchParams.get("includeSpam") !== "1";

  const status = searchParams.get("status");
  const activeStatusFilter = status === "active";
  const closedStatusFilter = status === "closed";
  const exactStatusFilter =
    status && status !== "all" && status !== "active" && status !== "closed" ? status : null;

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const dateFromTs = dateFrom ? new Date(dateFrom).toISOString() : null;
  let dateToExclusiveTs: string | null = null;
  if (dateTo) {
    const end = new Date(dateTo);
    if (Number.isNaN(end.getTime())) {
      return { error: "Invalid date range" };
    }
    end.setUTCDate(end.getUTCDate() + 1);
    dateToExclusiveTs = end.toISOString();
  }
  if ((dateFrom && Number.isNaN(Date.parse(dateFrom))) || (dateTo && !dateToExclusiveTs)) {
    return { error: "Invalid date range" };
  }

  const tagsRaw = searchParams.get("tags");
  const tagList = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const emailExact = searchParams.get("email")?.trim() || null;
  const q = searchParams.get("q")?.trim() || null;
  const ticketNumberExact = q ? parseTicketNumberQuery(q) : null;
  const like = q && !ticketNumberExact ? `%${q}%` : null;

  return {
    categoryFilter,
    ticketNumberExact,
    activeStatusFilter,
    closedStatusFilter,
    exactStatusFilter,
    dateFromTs,
    dateToExclusiveTs,
    tagList,
    emailExact,
    like,
    page,
    pageSize,
    offset,
    excludeSpamFilter,
    trashOnly
  };
}
