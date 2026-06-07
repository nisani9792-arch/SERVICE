const inFlight = new Map<string, Promise<unknown>>();

/**
 * Coalesce identical async reads within the same process tick (stats + list on dashboard mount).
 */
export function withQueryDedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
