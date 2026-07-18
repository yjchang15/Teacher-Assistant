import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeFor, addDays, isRangePreset } from "./dates";

test("addDays walks the calendar, crossing month/year boundaries", () => {
  assert.equal(addDays("2026-07-18", 1), "2026-07-19");
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("rangeFor today is a single day", () => {
  assert.deepEqual(rangeFor("today", "2026-07-18"), { start: "2026-07-18", end: "2026-07-18" });
});

test("rangeFor all is unbounded", () => {
  assert.deepEqual(rangeFor("all", "2026-07-18"), { start: "", end: "" });
});

test("rangeFor month spans the 1st to the last day", () => {
  assert.deepEqual(rangeFor("month", "2026-07-18"), { start: "2026-07-01", end: "2026-07-31" });
  // February in a non-leap year ends on the 28th.
  assert.deepEqual(rangeFor("month", "2026-02-10"), { start: "2026-02-01", end: "2026-02-28" });
});

test("rangeFor week is a 7-day Monday..Sunday span containing the day", () => {
  const { start, end } = rangeFor("week", "2026-07-18");
  assert.equal(addDays(start, 6), end);            // 7-day span
  assert.ok(start <= "2026-07-18" && "2026-07-18" <= end); // contains the day
  // start is a Monday (UTC day 1).
  const dow = new Date(`${start}T00:00:00Z`).getUTCDay();
  assert.equal(dow, 1);
});

test("isRangePreset guards the query param", () => {
  assert.ok(isRangePreset("month"));
  assert.ok(!isRangePreset("year"));
});
