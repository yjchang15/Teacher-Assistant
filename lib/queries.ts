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

export interface Account { id: number; code: string; display_name: string; role: "admin" | "class"; class_id: number | null; password_hash: string; must_change_password: boolean; active: boolean; last_login_at: string; }
export interface Student { id: number; class_id: number; seat: number; name: string; active: boolean; }

export async function getAccountByCode(code: string): Promise<Account | null> {
  const rows = await query<Account>("SELECT * FROM accounts WHERE lower(code)=lower($1) LIMIT 1", [code]);
  return rows[0] ? num(rows[0], ["id", "class_id"]) : null;
}
export async function getAccountById(id: number): Promise<Account | null> {
  const rows = await query<Account>("SELECT * FROM accounts WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ? num(rows[0], ["id", "class_id"]) : null;
}
export async function listAccounts(): Promise<Account[]> {
  return (await query<Account>("SELECT * FROM accounts ORDER BY role DESC,code")).map((r) => num(r, ["id", "class_id"]));
}
export async function touchLogin(id: number) { await execute("UPDATE accounts SET last_login_at=$1 WHERE id=$2", [new Date().toISOString(), id]); }
export async function updateAccountPassword(id: number, hash: string) { await execute("UPDATE accounts SET password_hash=$1,must_change_password=FALSE WHERE id=$2", [hash, id]); }
// A class has no user-facing name — it is identified by its account code
// (display_name = code). We create a fresh class (internal name = the unique
// code) and link the account to it in one statement. Skips if the code exists.
export async function createClassAccount(code: string, seatCount: number, hash: string): Promise<"created" | "exists"> {
  if (!code || await getAccountByCode(code)) return "exists";
  const now = new Date().toISOString();
  const rows = await query<{ id: number }>(
    "WITH c AS (INSERT INTO classes(name,seat_count,created_at) VALUES($1,$2,$3)" +
      " ON CONFLICT(name) DO UPDATE SET seat_count=excluded.seat_count RETURNING id)" +
      " INSERT INTO accounts(code,display_name,role,class_id,password_hash,must_change_password,active,created_at)" +
      " SELECT $4,$5,'class',c.id,$6,TRUE,TRUE,$3 FROM c ON CONFLICT(code) DO NOTHING RETURNING id",
    [code, seatCount, now, code, code, hash],
  );
  return rows.length ? "created" : "exists";
}
export async function setAccountActive(id: number, active: boolean) { await execute("UPDATE accounts SET active=$1 WHERE id=$2 AND role='class'", [active, id]); }
export async function resetAccountPassword(id: number, hash: string) { await execute("UPDATE accounts SET password_hash=$1,must_change_password=TRUE WHERE id=$2 AND role='class'", [hash, id]); }

export async function getStudents(classId: number): Promise<Student[]> {
  return (await query<Student>("SELECT * FROM students WHERE class_id=$1 ORDER BY seat", [classId])).map((r) => num(r, ["id", "class_id", "seat"]));
}
export async function saveStudent(classId: number, seat: number, name: string) {
  if (!classId || seat < 1 || seat > 60) return;
  await execute("INSERT INTO students(class_id,seat,name,active,created_at) VALUES($1,$2,$3,TRUE,$4) ON CONFLICT(class_id,seat) DO UPDATE SET name=excluded.name,active=TRUE", [classId, seat, name, new Date().toISOString()]);
}
export async function replaceStudents(classId: number, students: { seat: number; name: string }[]) {
  if (!classId || !students.length) return;
  const now = new Date().toISOString();
  await tx([
    ["DELETE FROM students WHERE class_id=$1", [classId]],
    ...students.map((student): [string, unknown[]] => [
      "INSERT INTO students(class_id,seat,name,active,created_at) VALUES($1,$2,$3,TRUE,$4)",
      [classId, student.seat, student.name, now],
    ]),
  ]);
}
export async function deactivateStudent(id: number, classId: number) { await execute("UPDATE students SET active=FALSE WHERE id=$1 AND class_id=$2", [id, classId]); }

export interface MissingDetail { seat: number; student_name: string; date: string; title: string; description: string; }
export async function getMissingDetails(classId: number, start: string, end: string): Promise<MissingDetail[]> {
  return (await query<MissingDetail>(`SELECT ar.seat,COALESCE(s.name,'') student_name,a.date,a.title,a.description
    FROM assignment_records ar JOIN assignments a ON a.id=ar.assignment_id
    LEFT JOIN students s ON s.class_id=a.class_id AND s.seat=ar.seat AND s.active=TRUE
    WHERE a.class_id=$1 AND a.date>=$2 AND a.date<=$3 ORDER BY ar.seat,a.date,a.id`, [classId, start, end])).map((r) => num(r, ["seat"]));
}

export const DEFAULT_JUNIOR_HIGH_ASSIGNMENTS = ["國文", "英文", "數學", "自然", "地理", "歷史", "公民"] as const;

// A class carries no user-facing name; its label is the linked account's
// display_name (falls back when a class has no active account row).
export async function getClasses(): Promise<ClassRoom[]> {
  const rows = await query<ClassRoom>(
    "SELECT c.id, COALESCE(a.display_name, '未命名班級') AS name, c.seat_count" +
      " FROM classes c LEFT JOIN accounts a ON a.class_id=c.id AND a.role='class'" +
      " ORDER BY c.id",
  );
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

export async function renameCustomAssignment(assignmentId: number, title: string): Promise<void> {
  if (!assignmentId || !title || DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.includes(title as typeof DEFAULT_JUNIOR_HIGH_ASSIGNMENTS[number])) return;
  const defaults = DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.map((_, index) => `$${index + 3}`).join(",");
  await execute(
    `UPDATE assignments SET title=$1 WHERE id=$2 AND title NOT IN (${defaults})
     AND NOT EXISTS (SELECT 1 FROM assignments other WHERE other.class_id=assignments.class_id AND other.date=assignments.date AND other.title=$1 AND other.id<>assignments.id)`,
    [title, assignmentId, ...DEFAULT_JUNIOR_HIGH_ASSIGNMENTS],
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
