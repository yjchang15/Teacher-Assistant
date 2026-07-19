"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE, credentialsValid, sessionToken } from "@/lib/auth";
import * as db from "@/lib/queries";

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
  if (!credentialsValid(username, password)) {
    redirect("/login?error=1");
  }
  const c = await cookies();
  c.set(AUTH_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  redirect("/admin");
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
  const name = s(formData, "name");
  const seatCount = i(formData, "seatCount");
  await db.createClass(name, seatCount);
  revalidateAll();
  redirect("/");
}

export async function addAssignment(formData: FormData) {
  const classId = i(formData, "classId");
  const date = s(formData, "date");
  const title = s(formData, "title");
  const description = s(formData, "description");
  if (date <= todayInTaipei()) await db.createAssignment(classId, date, title, description);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date }).toString()}`);
}

export async function editAssignmentDescription(formData: FormData) {
  const assignmentId = i(formData, "assignmentId");
  const classId = i(formData, "classId");
  const date = s(formData, "date");
  const description = s(formData, "description");
  await db.updateAssignmentDescription(assignmentId, description);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date, assignmentId: String(assignmentId) }).toString()}`);
}

export async function deleteAssignment(formData: FormData) {
  const assignmentId = i(formData, "assignmentId");
  const classId = i(formData, "classId");
  const date = s(formData, "date");
  await db.deleteCustomAssignment(assignmentId);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date }).toString()}`);
}

export async function renameAssignment(formData: FormData) {
  const assignmentId = i(formData, "assignmentId");
  const classId = i(formData, "classId");
  const date = s(formData, "date");
  await db.renameCustomAssignment(assignmentId, s(formData, "title"));
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date, assignmentId: String(assignmentId) }).toString()}`);
}

export async function toggleAssignmentSeat(formData: FormData) {
  const assignmentId = i(formData, "assignmentId");
  const seat = i(formData, "seat");
  await db.toggleMissingSeat(assignmentId, seat);
  revalidateAll();
}
