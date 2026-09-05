import "server-only";
import { query, execute, scalar, tx } from "./db";

// A class defaults to seats 1..DEFAULT_SEAT_COUNT until its roster says otherwise.
export const DEFAULT_SEAT_COUNT = 32;
export const MAX_SEAT = 60;

const clampSeatCount = (value: number) =>
  Math.min(MAX_SEAT, Math.max(1, Math.trunc(value) || DEFAULT_SEAT_COUNT));

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

// The app has exactly one user. `code` is the login name, seeded from APP_USERNAME.
export interface Account { id: number; code: string; display_name: string; password_hash: string; last_login_at: string; }

// A roster row is only 班級 + 座號 — no names are kept.
export interface Student { id: number; class_id: number; seat: number; active: boolean; }

// ── Account (single user) ─────────────────────────────────────────────────────

export async function getAccountByCode(code: string): Promise<Account | null> {
  const rows = await query<Account>("SELECT * FROM accounts WHERE lower(code)=lower($1) LIMIT 1", [code]);
  return rows[0] ? num(rows[0], ["id"]) : null;
}
export async function getAccountById(id: number): Promise<Account | null> {
  const rows = await query<Account>("SELECT * FROM accounts WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ? num(rows[0], ["id"]) : null;
}
export async function touchLogin(id: number) { await execute("UPDATE accounts SET last_login_at=$1 WHERE id=$2", [new Date().toISOString(), id]); }
export async function updateAccountPassword(id: number, hash: string) { await execute("UPDATE accounts SET password_hash=$1 WHERE id=$2", [hash, id]); }

// ── Classes ───────────────────────────────────────────────────────────────────

export async function getClasses(): Promise<ClassRoom[]> {
  const rows = await query<ClassRoom>("SELECT id,name,seat_count FROM classes ORDER BY name,id");
  return rows.map((row) => num(row, ["id", "seat_count"]));
}

export async function createClass(name: string, seatCount: number): Promise<"created" | "exists"> {
  if (!name) return "exists";
  const rows = await query<{ id: number }>(
    "INSERT INTO classes (name,seat_count,created_at) VALUES ($1,$2,$3) ON CONFLICT(name) DO NOTHING RETURNING id",
    [name, clampSeatCount(seatCount), new Date().toISOString()],
  );
  return rows.length ? "created" : "exists";
}

// Rejected (rather than throwing on the UNIQUE index) when another class
// already holds the name.
export async function updateClass(id: number, name: string, seatCount: number): Promise<"updated" | "exists"> {
  if (!id || !name) return "exists";
  const rows = await query<{ id: number }>(
    "UPDATE classes SET name=$1,seat_count=$2 WHERE id=$3" +
      " AND NOT EXISTS (SELECT 1 FROM classes other WHERE other.name=$1 AND other.id<>$3) RETURNING id",
    [name, clampSeatCount(seatCount), id],
  );
  return rows.length ? "updated" : "exists";
}

// Cascades to assignments → assignment_records and to the roster.
export async function deleteClass(id: number): Promise<void> {
  if (id) await execute("DELETE FROM classes WHERE id=$1", [id]);
}

// ── Roster (班級 + 座號) ───────────────────────────────────────────────────────

export async function getStudents(classId: number): Promise<Student[]> {
  if (!classId) return [];
  return (await query<Student>("SELECT id,class_id,seat,active FROM students WHERE class_id=$1 ORDER BY seat", [classId])).map((r) => num(r, ["id", "class_id", "seat"]));
}
export async function saveStudent(classId: number, seat: number) {
  if (!classId || seat < 1 || seat > MAX_SEAT) return;
  await execute("INSERT INTO students(class_id,seat,active,created_at) VALUES($1,$2,TRUE,$3) ON CONFLICT(class_id,seat) DO UPDATE SET active=TRUE", [classId, seat, new Date().toISOString()]);
}
export async function replaceStudents(classId: number, seats: number[]) {
  if (!classId || !seats.length) return;
  const now = new Date().toISOString();
  await tx([
    ["DELETE FROM students WHERE class_id=$1", [classId]],
    ...seats.map((seat): [string, unknown[]] => [
      "INSERT INTO students(class_id,seat,active,created_at) VALUES($1,$2,TRUE,$3)",
      [classId, seat, now],
    ]),
  ]);
}
export async function deactivateStudent(id: number, classId: number) { await execute("UPDATE students SET active=FALSE WHERE id=$1 AND class_id=$2", [id, classId]); }

// ── Reports ───────────────────────────────────────────────────────────────────

export interface MissingDetail { seat: number; date: string; title: string; description: string; }
export async function getMissingDetails(classId: number, start: string, end: string): Promise<MissingDetail[]> {
  return (await query<MissingDetail>(`SELECT ar.seat,a.date,a.title,a.description
    FROM assignment_records ar JOIN assignments a ON a.id=ar.assignment_id
    WHERE a.class_id=$1 AND a.date>=$2 AND a.date<=$3 ORDER BY ar.seat,a.date,a.id`, [classId, start, end])).map((r) => num(r, ["seat"]));
}

export interface ClassMissingSummary { assignment_id: number; date: string; title: string; description: string; seats: string; }
export async function getClassMissingSummary(classId: number, start: string, end: string): Promise<ClassMissingSummary[]> {
  return (await query<ClassMissingSummary>(`SELECT a.id assignment_id,a.date,a.title,a.description,
    STRING_AGG(ar.seat::text, ',' ORDER BY ar.seat) seats
    FROM assignments a JOIN assignment_records ar ON ar.assignment_id=a.id
    WHERE a.class_id=$1 AND a.date>=$2 AND a.date<=$3
    GROUP BY a.id,a.date,a.title,a.description ORDER BY a.date,a.id`, [classId, start, end])).map((row) => num(row, ["assignment_id"]));
}

export interface MaintenanceMissingRecord { id: number; seat: number; title: string; description: string; }
export async function getMaintenanceMissingRecords(classId: number, date: string): Promise<MaintenanceMissingRecord[]> {
  return (await query<MaintenanceMissingRecord>(`SELECT ar.id,ar.seat,a.title,a.description FROM assignment_records ar
    JOIN assignments a ON a.id=ar.assignment_id WHERE a.class_id=$1 AND a.date=$2 ORDER BY a.id,ar.seat`, [classId, date])).map((row) => num(row, ["id", "seat"]));
}
export async function deleteAssignmentRecord(id: number): Promise<void> { if (id) await execute("DELETE FROM assignment_records WHERE id=$1", [id]); }

// ── 作業項目 ───────────────────────────────────────────────────────────────────
// Every item is created by the teacher — nothing is seeded, so all of them can
// be renamed and deleted. Listed in creation order.

export async function getAssignments(classId: number, date: string): Promise<Assignment[]> {
  if (!classId || !date) return [];
  const rows = await query<Assignment>(
    "SELECT id,class_id,date,title,description FROM assignments WHERE class_id=$1 AND date=$2 ORDER BY id",
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

export async function deleteAssignment(assignmentId: number): Promise<void> {
  if (assignmentId) await execute("DELETE FROM assignments WHERE id=$1", [assignmentId]);
}

// Skipped when the class already has another item with that title on that date,
// which the UNIQUE(class_id,date,title) index would reject anyway.
export async function renameAssignment(assignmentId: number, title: string): Promise<void> {
  if (!assignmentId || !title) return;
  await execute(
    `UPDATE assignments SET title=$1 WHERE id=$2
     AND NOT EXISTS (SELECT 1 FROM assignments other WHERE other.class_id=assignments.class_id AND other.date=assignments.date AND other.title=$1 AND other.id<>assignments.id)`,
    [title, assignmentId],
  );
}

export async function getMissingSeats(assignmentId: number): Promise<number[]> {
  const rows = await query<{ seat: number }>(
    "SELECT seat FROM assignment_records WHERE assignment_id=$1 ORDER BY seat",
    [assignmentId],
  );
  return rows.map((row) => Number(row.seat));
}
export async function getAssignmentClassId(assignmentId: number): Promise<number> { return Number(await scalar<number>("SELECT COALESCE(MAX(class_id),0) FROM assignments WHERE id=$1", [assignmentId])); }

export async function toggleMissingSeat(assignmentId: number, seat: number): Promise<void> {
  if (!assignmentId || !Number.isInteger(seat) || seat < 1 || seat > MAX_SEAT) return;
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

// ── 座號 × 作業項目 未交統計（Excel 匯出用）──────────────────────────────────────

export interface MatrixRow {
  seat: number;
  counts: Record<string, number>; // 作業項目 → 未交筆數
  total: number;
}

export interface Matrix {
  titles: string[];
  rows: MatrixRow[];
  colTotals: Record<string, number>;
  grandTotal: number;
}

export async function getAssignmentMatrix(classId: number, start: string, end: string, seatCount: number): Promise<Matrix> {
  if (!classId) return { titles: [], rows: [], colTotals: {}, grandTotal: 0 };
  const params: unknown[] = [classId];
  let dateWhere = "class_id=$1";
  if (start) { params.push(start); dateWhere += ` AND date >= $${params.length}`; }
  if (end) { params.push(end); dateWhere += ` AND date <= $${params.length}`; }
  const titleRows = await query<{ title: string }>(
    `SELECT DISTINCT title FROM assignments WHERE ${dateWhere} ORDER BY title`,
    params,
  );
  const titles = titleRows.map((row) => row.title);
  const raw = (await query<{ seat: number; title: string; n: number }>(
    `SELECT ar.seat,a.title,COUNT(*) AS n FROM assignment_records ar JOIN assignments a ON a.id=ar.assignment_id WHERE ${dateWhere.replaceAll("date", "a.date").replace("class_id", "a.class_id")} GROUP BY ar.seat,a.title`,
    params,
  )).map((row) => num(row, ["seat", "n"]));
  const rows: MatrixRow[] = [];
  const colTotals: Record<string, number> = Object.fromEntries(titles.map((title) => [title, 0]));
  let grandTotal = 0;
  for (let seat = 1; seat <= seatCount; seat++) {
    const counts: Record<string, number> = Object.fromEntries(titles.map((title) => [title, 0]));
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
  return { titles, rows, colTotals, grandTotal };
}
