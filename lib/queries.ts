import "server-only";
import { query, execute, scalar, tx } from "./db";

// Single class: seats 1..SEAT_COUNT.
export const SEAT_COUNT = 32;

// Coerce DB numerics (some drivers return DOUBLE PRECISION / bigint as strings).
function num<T>(row: T, keys: (keyof T)[]): T {
  const r = row as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k as string];
    if (v != null) r[k as string] = Number(v);
  }
  return row;
}

// ── App settings (key/value) ──────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const v = await scalar<string | null>("SELECT value FROM app_settings WHERE key=$1", [key]);
  return v ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    "INSERT INTO app_settings (key,value) VALUES ($1,$2)" +
      " ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, value],
  );
}

// ── Subjects ──────────────────────────────────────────────────────────────────

export interface Subject {
  id: number;
  name: string;
  sort_order: number;
}

export async function getSubjects(): Promise<Subject[]> {
  const rows = await query<Subject>("SELECT * FROM subjects ORDER BY sort_order ASC, id ASC");
  return rows.map((r) => num(r, ["id", "sort_order"]));
}

// ── Records (作業未交) ─────────────────────────────────────────────────────────

export type RecordStatus = "open" | "late"; // 未交 / 已補交

export interface HomeworkRecord {
  id: number;
  date: string;
  subject: string;
  seat: number;
  status: RecordStatus;
  created_at: string;
  resolved_at: string;
}

// Records logged for one day + subject (what the 小老師 sees while registering).
export async function getDayRecords(date: string, subject: string): Promise<HomeworkRecord[]> {
  const rows = await query<HomeworkRecord>(
    "SELECT * FROM records WHERE date=$1 AND subject=$2 ORDER BY seat ASC",
    [date, subject],
  );
  return rows.map((r) => num(r, ["id", "seat"]));
}

// Bulk-log 未交 seats for a day+subject. Idempotent: the unique index means a
// re-logged (date,subject,seat) is skipped rather than duplicated.
export async function addRecords(date: string, subject: string, seats: number[]): Promise<void> {
  const valid = [...new Set(seats)].filter((s) => Number.isInteger(s) && s >= 1 && s <= SEAT_COUNT);
  if (!valid.length) return;
  const now = new Date().toISOString();
  await tx(
    valid.map((seat) => [
      "INSERT INTO records (date,subject,seat,status,created_at) VALUES ($1,$2,$3,'open',$4)" +
        " ON CONFLICT (date,subject,seat) DO NOTHING",
      [date, subject, seat, now],
    ]),
  );
}

export async function setRecordStatus(id: number, status: RecordStatus): Promise<void> {
  await execute(
    "UPDATE records SET status=$1, resolved_at=$2 WHERE id=$3",
    [status, status === "late" ? new Date().toISOString() : "", id],
  );
}

export async function deleteRecord(id: number): Promise<void> {
  await execute("DELETE FROM records WHERE id=$1", [id]);
}

// ── Matrix aggregation (座號 × 科別，仍未交筆數) ─────────────────────────────────

export interface MatrixRow {
  seat: number;
  counts: Record<string, number>; // subject → 仍未交筆數
  total: number;
}

export interface Matrix {
  subjects: string[];
  rows: MatrixRow[];               // seats 1..SEAT_COUNT
  colTotals: Record<string, number>;
  grandTotal: number;
}

// Counts only status='open' (已補交 excluded, per spec). `start`/`end` are
// inclusive "YYYY-MM-DD"; "" means unbounded on that side.
export async function getMatrix(start: string, end: string): Promise<Matrix> {
  const subjects = (await getSubjects()).map((s) => s.name);

  const params: unknown[] = [];
  let where = "status='open'";
  if (start) { params.push(start); where += ` AND date >= $${params.length}`; }
  if (end) { params.push(end); where += ` AND date <= $${params.length}`; }

  const raw = (await query<{ seat: number; subject: string; n: number }>(
    `SELECT seat, subject, COUNT(*) AS n FROM records WHERE ${where} GROUP BY seat, subject`,
    params,
  )).map((r) => num(r, ["seat", "n"]));

  const rows: MatrixRow[] = [];
  const colTotals: Record<string, number> = Object.fromEntries(subjects.map((s) => [s, 0]));
  let grandTotal = 0;

  for (let seat = 1; seat <= SEAT_COUNT; seat++) {
    const counts: Record<string, number> = Object.fromEntries(subjects.map((s) => [s, 0]));
    let total = 0;
    for (const r of raw) {
      if (r.seat === seat && r.subject in counts) {
        counts[r.subject] = r.n;
        total += r.n;
        colTotals[r.subject] += r.n;
      }
    }
    grandTotal += total;
    rows.push({ seat, counts, total });
  }

  return { subjects, rows, colTotals, grandTotal };
}
