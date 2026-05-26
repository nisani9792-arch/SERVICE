import type { DashboardStatsModel } from "@/components/DashboardStats";
import type { Ticket, TicketListResponse } from "@/lib/types";

const STATS_KEY = "service_dashboard_stats_v1";
const LIST_PREFIX = "service_dashboard_list_v1:";
const TTL_MS = 10 * 60 * 1000;

type CacheEnvelope<T> = { at: number; data: T };

function readEnvelope<T>(key: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeEnvelope<T>(key: string, data: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: CacheEnvelope<T> = { at: Date.now(), data };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readStatsCache(): DashboardStatsModel | null {
  return readEnvelope<DashboardStatsModel>(STATS_KEY);
}

export function writeStatsCache(stats: DashboardStatsModel): void {
  writeEnvelope(STATS_KEY, stats);
}

/** Clear cached headline stats so the next fetch cannot show stale KPIs after server mutations. */
export function clearSessionStatsCache(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STATS_KEY);
  } catch {
    /* ignore */
  }
}

export function listCacheKey(queryKey: string): string {
  return `${LIST_PREFIX}${queryKey}`;
}

export function readListCache(queryKey: string): TicketListResponse | null {
  return readEnvelope<TicketListResponse>(listCacheKey(queryKey));
}

export function writeListCache(queryKey: string, data: TicketListResponse): void {
  writeEnvelope(listCacheKey(queryKey), data);
}

export type CachedListState = {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};

export function readListStateCache(queryKey: string): CachedListState | null {
  const cached = readListCache(queryKey);
  if (!cached) return null;
  return {
    items: cached.items,
    total: cached.total,
    page: cached.page,
    pageSize: cached.pageSize
  };
}
