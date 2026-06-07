import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export { withQueryDedup } from "@/lib/query-dedup";

let _sql: NeonQueryFunction<false, false> | null = null;

export function sql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  _sql = neon(url);
  return _sql;
}
