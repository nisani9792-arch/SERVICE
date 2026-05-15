let statsCache: { at: number; payload: unknown } | null = null;

export function getStatsCache(): { at: number; payload: unknown } | null {
  return statsCache;
}

export function setStatsCache(payload: unknown): void {
  statsCache = { at: Date.now(), payload };
}

export function invalidateStatsCache(): void {
  statsCache = null;
}

export const STATS_CACHE_MS = 8_000;
