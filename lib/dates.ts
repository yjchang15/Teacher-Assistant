// Pure date-range helpers for the 彙整 filter. Unit-tested (see dates.test.ts).
// Dates are "YYYY-MM-DD" strings; computed in UTC for deterministic results.

export type RangePreset = "today" | "week" | "month" | "all";

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "今天",
  week: "本週",
  month: "本月",
  all: "全部",
};

export function isRangePreset(v: string): v is RangePreset {
  return v === "today" || v === "week" || v === "month" || v === "all";
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const dt = parse(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmt(dt);
}

// Inclusive {start, end} for a preset relative to `todayIso`. "" means unbounded
// (used by "全部"). Week starts Monday.
export function rangeFor(preset: RangePreset, todayIso: string): { start: string; end: string } {
  if (preset === "all") return { start: "", end: "" };
  if (preset === "today") return { start: todayIso, end: todayIso };
  if (preset === "week") {
    const dow = parse(todayIso).getUTCDay(); // 0 Sun .. 6 Sat
    const toMonday = (dow + 6) % 7;
    const start = addDays(todayIso, -toMonday);
    return { start, end: addDays(start, 6) };
  }
  // month
  const dt = parse(todayIso);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  return {
    start: fmt(new Date(Date.UTC(y, m, 1))),
    end: fmt(new Date(Date.UTC(y, m + 1, 0))),
  };
}
