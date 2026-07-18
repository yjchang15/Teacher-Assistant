// Small pure helpers — the kind that belong in unit-tested modules (see
// format.test.ts). Server-only DB code lives in db.ts / queries.ts instead.

// Format a number as thousands-separated integer, e.g. 1234567 → "1,234,567".
export function thousands(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// Truncate to `max` chars with an ellipsis.
export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}
