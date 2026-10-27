// Simple in-memory limiter (per server instance). Put a CDN/WAF in front for global limits.
const hits = new Map<string, { n: number; reset: number }>();

export function limit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || e.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  e.n++;
  return e.n <= max;
}
