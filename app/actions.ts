"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE, createSessionToken, DEFAULT_CLASS_PASSWORD, passwordHash } from "@/lib/auth";
import { requireAccount, requireAdmin } from "@/lib/session";
import * as db from "@/lib/queries";
import * as XLSX from "xlsx";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const i = (fd: FormData, k: string) => Math.trunc(Number(String(fd.get(k) ?? "").trim()));

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/admin");
}

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(formData: FormData) {
  const username = s(formData, "username");
  const password = s(formData, "password");
  const account = await db.getAccountByCode(username);
  if (!account?.active || account.password_hash !== await passwordHash(password)) redirect("/login?error=1");
  await db.touchLogin(account.id);
  const c = await cookies();
  c.set(AUTH_COOKIE, await createSessionToken({ id: account.id, code: account.code, role: account.role, classId: account.class_id, mustChange: account.must_change_password }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  redirect(account.must_change_password ? "/password" : "/");
}

export async function logout() {
  const c = await cookies();
  c.delete(AUTH_COOKIE);
  redirect("/");
}

// ── 作業未交登記（前台，免登入）────────────────────────────────────────────────

// Log the checked seats as 未交 for a day + subject.
export async function logRecords(formData: FormData) {
  const date = s(formData, "date");
  const subject = s(formData, "subject");
  const seats = formData.getAll("seats").map((v) => Math.trunc(Number(v)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayInTaipei() && subject) {
    await db.addRecords(date, subject, seats);
  }
  revalidateAll();
}

export async function markLate(formData: FormData) {
  await db.setRecordStatus(i(formData, "id"), "late");
  revalidateAll();
}

export async function reopenRecord(formData: FormData) {
  await db.setRecordStatus(i(formData, "id"), "open");
  revalidateAll();
}

export async function removeRecord(formData: FormData) {
  await db.deleteRecord(i(formData, "id"));
  revalidateAll();
  const date = s(formData, "date");
  const subject = s(formData, "subject");
  const seat = i(formData, "seat");
  const status = s(formData, "status") === "late" ? "late" : "open";
  if (date && subject && seat) {
    const params = new URLSearchParams({ date, subject, deletedSeat: String(seat), deletedStatus: status });
    redirect(`/?${params.toString()}`);
  }
}

export async function changePassword(formData: FormData) {
  const account = await requireAccount(true);
  const password = s(formData, "password");
  const confirm = s(formData, "confirm");
  if (password.length < 8 || password !== confirm) redirect("/password?error=1");
  await db.updateAccountPassword(account.id, await passwordHash(password));
  const c = await cookies();
  c.set(AUTH_COOKIE, await createSessionToken({ id: account.id, code: account.code, role: account.role, classId: account.class_id, mustChange: false }), { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/" });
  redirect("/");
}

export async function addClassAccount(formData: FormData) {
  await requireAdmin();
  await db.createClassAccount(s(formData,"code"), s(formData,"name"), Math.min(60,Math.max(1,i(formData,"seatCount"))), await passwordHash(DEFAULT_CLASS_PASSWORD));
  revalidateAll(); redirect("/admin/accounts");
}
export async function toggleClassAccount(formData: FormData) { await requireAdmin(); await db.setAccountActive(i(formData,"id"), s(formData,"active") === "true"); revalidateAll(); }
export async function resetClassPassword(formData: FormData) { await requireAdmin(); await db.resetAccountPassword(i(formData,"id"), await passwordHash(DEFAULT_CLASS_PASSWORD)); revalidateAll(); }
export async function upsertStudent(formData: FormData) { const a=await requireAccount(); const classId=a.role==="admin"?i(formData,"classId"):(a.class_id??0); await db.saveStudent(classId,i(formData,"seat"),s(formData,"studentNumber"),s(formData,"name")); revalidateAll(); }
export async function removeStudent(formData: FormData) { const a=await requireAccount(); const classId=a.role==="admin"?i(formData,"classId"):(a.class_id??0); await db.deactivateStudent(i(formData,"id"),classId); revalidateAll(); }

export async function importStudentRoster(formData: FormData) {
  const account = await requireAccount();
  const classId = account.role === "admin" ? i(formData, "classId") : account.class_id ?? 0;
  const file = formData.get("file");
  const back = `/students?${new URLSearchParams({ classId: String(classId) }).toString()}`;
  if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) redirect(`${back}&error=file`);
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) redirect(`${back}&error=sheet`);
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    const headers = (rows[0] ?? []).map((value) => String(value).trim().toLowerCase());
    const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
    const seatColumn = findColumn("座號", "seat");
    const numberColumn = findColumn("學號", "student_number", "student number", "studentnumber");
    const nameColumn = findColumn("姓名", "name");
    if (seatColumn < 0 || numberColumn < 0) redirect(`${back}&error=headers`);
    const parsed = rows.slice(1).map((row) => ({
      seat: Math.trunc(Number(String(row[seatColumn] ?? "").trim())),
      studentNumber: String(row[numberColumn] ?? "").trim(),
      name: nameColumn >= 0 ? String(row[nameColumn] ?? "").trim() : "",
    })).filter((row) => row.seat || row.studentNumber || row.name);
    const seats = new Set<number>(); const numbers = new Set<string>();
    const valid = parsed.length > 0 && parsed.length <= 60 && parsed.every((row) => row.seat >= 1 && row.seat <= 60 && row.studentNumber && !seats.has(row.seat) && !numbers.has(row.studentNumber) && (seats.add(row.seat), numbers.add(row.studentNumber), true));
    if (!valid) redirect(`${back}&error=rows`);
    await db.replaceStudents(classId, parsed);
    revalidateAll();
    redirect(`${back}&imported=${parsed.length}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(`${back}&error=parse`);
  }
}

export async function undoDeleteRecord(formData: FormData) {
  const date = s(formData, "date");
  const subject = s(formData, "subject");
  const seat = i(formData, "seat");
  const status = s(formData, "status") === "late" ? "late" : "open";
  await db.restoreRecord(date, subject, seat, status);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ date, subject }).toString()}`);
}

export async function addClass(formData: FormData) {
  await requireAdmin();
  const name = s(formData, "name");
  const seatCount = i(formData, "seatCount");
  await db.createClass(name, seatCount);
  revalidateAll();
  redirect("/");
}

export async function addAssignment(formData: FormData) {
  const account = await requireAccount();
  const classId = account.role === "admin" ? i(formData, "classId") : account.class_id ?? 0;
  const date = s(formData, "date");
  const title = s(formData, "title");
  const description = s(formData, "description");
  if (date <= todayInTaipei()) await db.createAssignment(classId, date, title, description);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date }).toString()}`);
}

export async function editAssignmentDescription(formData: FormData) {
  const account = await requireAccount();
  const assignmentId = i(formData, "assignmentId");
  if (account.role !== "admin" && await db.getAssignmentClassId(assignmentId) !== account.class_id) return;
  const description = s(formData, "description");
  await db.updateAssignmentDescription(assignmentId, description);
  revalidateAll();
}

export async function deleteAssignment(formData: FormData) {
  const account = await requireAccount();
  const assignmentId = i(formData, "assignmentId");
  const classId = account.role === "admin" ? i(formData, "classId") : account.class_id ?? 0;
  if (await db.getAssignmentClassId(assignmentId) !== classId) return;
  const date = s(formData, "date");
  await db.deleteCustomAssignment(assignmentId);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date }).toString()}`);
}

export async function renameAssignment(formData: FormData) {
  const account = await requireAccount();
  const assignmentId = i(formData, "assignmentId");
  const classId = account.role === "admin" ? i(formData, "classId") : account.class_id ?? 0;
  if (await db.getAssignmentClassId(assignmentId) !== classId) return;
  const date = s(formData, "date");
  await db.renameCustomAssignment(assignmentId, s(formData, "title"));
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date, assignmentId: String(assignmentId) }).toString()}`);
}

export async function toggleAssignmentSeat(formData: FormData) {
  const account = await requireAccount();
  const assignmentId = i(formData, "assignmentId");
  if (account.role !== "admin" && await db.getAssignmentClassId(assignmentId) !== account.class_id) return;
  const seat = i(formData, "seat");
  await db.toggleMissingSeat(assignmentId, seat);
  revalidateAll();
}
