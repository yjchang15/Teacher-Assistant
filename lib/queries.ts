import "server-only";
import { query, execute, scalar, tx } from "./db";

// Single class: seats 1..SEAT_COUNT.
export const SEAT_COUNT = 32;

export interface ClassRoom {
  id: number;
  name: string;
  seat_count: number;
}

export interface Assignment {
  id: number;
  class_id: number;
  date: string;
  title: string;
  description: string;
}

export const DEFAULT_JUNIOR_HIGH_ASSIGNMENTS = ["國文", "英文", "數學", "自然", "地理", "歷史", "公民"] as const;

export async function getClasses(): Promise<ClassRoom[]> {
  const rows = await query<ClassRoom>("SELECT id,name,seat_count FROM classes ORDER BY id");
  return rows.map((row) => num(row, ["id", "seat_count"]));
}

export async function createClass(name: string, seatCount = SEAT_COUNT): Promise<void> {
  if (!name) return;
  const count = Math.min(60, Math.max(1, Math.trunc(seatCount) || SEAT_COUNT));
  await execute(
    "INSERT INTO classes (name,seat_count,created_at) VALUES ($1,$2,$3) ON CONFLICT(name) DO NOTHING",
    [name, count, new Date().toISOString()],
  );
}

export async function getAssignments(classId: number, date: string): Promise<Assignment[]> {
  if (!classId || !date) return [];
  const createdAt = new Date().toISOString();
  await tx(DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.map((title) => [
    "INSERT INTO assignments (class_id,date,title,description,created_at) VALUES ($1,$2,$3,'',$4) ON CONFLICT(class_id,date,title) DO NOTHING",
    [classId, date, title, createdAt],
  ]));
  const rows = await query<Assignment>(
    `SELECT id,class_id,date,title,description FROM assignments WHERE class_id=$1 AND date=$2
     ORDER BY CASE title
       WHEN '國文' THEN 1 WHEN '英文' THEN 2 WHEN '數學' THEN 3 WHEN '自然' THEN 4
       WHEN '地理' THEN 5 WHEN '歷史' THEN 6 WHEN '公民' THEN 7 ELSE 99 END, id`,
    [classId, date],
  );
  return rows.map((row) => num(row, ["id", "class_id"]));
}

export async function createAssignment(classId: number, date: string, title: string, description: string): Promise<void> {
  if (!classId || !date || !title) return;
  await execute(
    "INSERT INTO assignments (class_id,date,title,description,created_at) VALUES ($1,$2,$3,$4,$5)" +
      " ON CONFLICT(class_id,date,title) DO UPDATE SET description=excluded.description",
    [classId, date, title, description, new Date().toISOString()],
  );
}

export async function updateAssignmentDescription(assignmentId: number, description: string): Promise<void> {
  if (!assignmentId) return;
  await execute("UPDATE assignments SET description=$1 WHERE id=$2", [description, assignmentId]);
}

export async function deleteCustomAssignment(assignmentId: number): Promise<void> {
  if (!assignmentId) return;
  await execute(
    `DELETE FROM assignments WHERE id=$1 AND title NOT IN (${DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.map((_, index) => `$${index + 2}`).join(",")})`,
    [assignmentId, ...DEFAULT_JUNIOR_HIGH_ASSIGNMENTS],
  );
}

export async function getMissingSeats(assignmentId: number): Promise<number[]> {
  const rows = await query<{ seat: number }>(
    "SELECT seat FROM assignment_records WHERE assignment_id=$1 ORDER BY seat",
    [assignmentId],
  );
  return rows.map((row) => Number(row.seat));
}

export async function toggleMissingSeat(assignmentId: number, seat: number): Promise<void> {
  if (!assignmentId || !Number.isInteger(seat) || seat < 1 || seat > 60) return;
  await execute(
    "WITH deleted AS (DELETE FROM assignment_records WHERE assignment_id=$1 AND seat=$2 RETURNING id)" +
      " INSERT INTO assignment_records (assignment_id,seat,created_at)" +
      " SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM deleted) ON CONFLICT DO NOTHING",
    [assignmentId, seat, new Date().toISOString()],
  );
}

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

export async function restoreRecord(
  date: string,
  subject: string,
  seat: number,
  status: RecordStatus,
): Promise<void> {
  if (!date || !subject || !Number.isInteger(seat) || seat < 1 || seat > SEAT_COUNT) return;
  const now = new Date().toISOString();
  await execute(
    "INSERT INTO records (date,subject,seat,status,created_at,resolved_at) VALUES ($1,$2,$3,$4,$5,$6)" +
      " ON CONFLICT (date,subject,seat) DO UPDATE SET status=excluded.status,resolved_at=excluded.resolved_at",
    [date, subject, seat, status, now, status === "late" ? now : ""],
  );
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

export async function getAssignmentMatrix(classId: number, start: string, end: string, seatCount: number): Promise<Matrix> {
  if (!classId) return { subjects: [], rows: [], colTotals: {}, grandTotal: 0 };
  const params: unknown[] = [classId];
  let dateWhere = "class_id=$1";
  if (start) { params.push(start); dateWhere += ` AND date >= $${params.length}`; }
  if (end) { params.push(end); dateWhere += ` AND date <= $${params.length}`; }
  const titleRows = await query<{ title: string }>(
    `SELECT DISTINCT title FROM assignments WHERE ${dateWhere} ORDER BY title`,
    params,
  );
  const subjects = titleRows.map((row) => row.title);
  const raw = (await query<{ seat: number; title: string; n: number }>(
    `SELECT ar.seat,a.title,COUNT(*) AS n FROM assignment_records ar JOIN assignments a ON a.id=ar.assignment_id WHERE ${dateWhere.replaceAll("date", "a.date").replace("class_id", "a.class_id")} GROUP BY ar.seat,a.title`,
    params,
  )).map((row) => num(row, ["seat", "n"]));
  const rows: MatrixRow[] = [];
  const colTotals: Record<string, number> = Object.fromEntries(subjects.map((title) => [title, 0]));
  let grandTotal = 0;
  for (let seat = 1; seat <= seatCount; seat++) {
    const counts: Record<string, number> = Object.fromEntries(subjects.map((title) => [title, 0]));
    let total = 0;
    for (const row of raw) {
      if (row.seat === seat && row.title in counts) {
        counts[row.title] = row.n;
        colTotals[row.title] += row.n;
        total += row.n;
      }
    }
    grandTotal += total;
    rows.push({ seat, counts, total });
  }
  return { subjects, rows, colTotals, grandTotal };
}
