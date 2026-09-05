"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE, createSessionToken, passwordHash } from "@/lib/auth";
import { requireAccount } from "@/lib/session";
import * as db from "@/lib/queries";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const i = (fd: FormData, k: string) => Math.trunc(Number(String(fd.get(k) ?? "").trim()));

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/classes");
  revalidatePath("/admin/class-summary");
  revalidatePath("/admin/maintenance");
}

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ── Auth (single user) ────────────────────────────────────────────────────────

export async function login(formData: FormData) {
  const account = await db.getAccountByCode(s(formData, "username"));
  if (!account || account.password_hash !== await passwordHash(s(formData, "password"))) redirect("/login?error=1");
  await db.touchLogin(account.id);
  const c = await cookies();
  c.set(AUTH_COOKIE, await createSessionToken({ id: account.id, code: account.code }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  redirect("/");
}

export async function logout() {
  const c = await cookies();
  c.delete(AUTH_COOKIE);
  redirect("/");
}

export async function changePassword(formData: FormData) {
  const account = await requireAccount();
  const password = s(formData, "password");
  if (!password || password !== s(formData, "confirm")) redirect("/password?error=1");
  await db.updateAccountPassword(account.id, await passwordHash(password));
  redirect("/");
}

// ── 班級 ──────────────────────────────────────────────────────────────────────

export async function addClass(formData: FormData) {
  await requireAccount();
  const name = s(formData, "name");
  if (!name || name.length > 20) redirect("/admin/classes?error=name");
  const result = await db.createClass(name, i(formData, "headcount"));
  revalidateAll();
  redirect(`/admin/classes?${result === "created" ? "created=1" : "error=exists"}`);
}

export async function editClass(formData: FormData) {
  await requireAccount();
  const name = s(formData, "name");
  if (!name || name.length > 20) redirect("/admin/classes?error=name");
  const result = await db.renameClass(i(formData, "id"), name);
  revalidateAll();
  redirect(`/admin/classes?${result === "updated" ? "updated=1" : "error=exists"}`);
}

export async function removeClass(formData: FormData) {
  await requireAccount();
  await db.deleteClass(i(formData, "id"));
  revalidateAll();
  redirect("/admin/classes?deleted=1");
}

export async function addClassSeat(formData: FormData) {
  await requireAccount();
  await db.addSeat(i(formData, "classId"), i(formData, "seat"));
  revalidateAll();
  redirect("/admin/classes");
}

export async function removeClassSeat(formData: FormData) {
  await requireAccount();
  await db.deleteSeat(i(formData, "classId"), i(formData, "seat"));
  revalidateAll();
  redirect("/admin/classes");
}

// ── 作業項目 ───────────────────────────────────────────────────────────────────

export async function addAssignment(formData: FormData) {
  await requireAccount();
  const classId = i(formData, "classId");
  const date = s(formData, "date");
  if (date <= todayInTaipei()) await db.createAssignment(classId, date, s(formData, "title"), s(formData, "description"));
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date }).toString()}`);
}

export async function editAssignmentDescription(formData: FormData) {
  await requireAccount();
  await db.updateAssignmentDescription(i(formData, "assignmentId"), s(formData, "description"));
  revalidateAll();
}

export async function deleteAssignment(formData: FormData) {
  await requireAccount();
  const classId = i(formData, "classId");
  const assignmentId = i(formData, "assignmentId");
  if (await db.getAssignmentClassId(assignmentId) !== classId) return;
  const date = s(formData, "date");
  await db.deleteAssignment(assignmentId);
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date }).toString()}`);
}

export async function renameAssignment(formData: FormData) {
  await requireAccount();
  const classId = i(formData, "classId");
  const assignmentId = i(formData, "assignmentId");
  if (await db.getAssignmentClassId(assignmentId) !== classId) return;
  const date = s(formData, "date");
  await db.renameAssignment(assignmentId, s(formData, "title"));
  revalidateAll();
  redirect(`/?${new URLSearchParams({ classId: String(classId), date, assignmentId: String(assignmentId) }).toString()}`);
}

export async function toggleAssignmentSeat(formData: FormData) {
  await requireAccount();
  await db.toggleMissingSeat(i(formData, "assignmentId"), i(formData, "seat"));
  revalidateAll();
}

export async function adminDeleteMissingRecord(formData: FormData) {
  await requireAccount();
  await db.deleteAssignmentRecord(i(formData, "id"));
  revalidateAll();
  const params = new URLSearchParams({ classId: s(formData, "classId"), date: s(formData, "date"), deleted: "record" });
  redirect(`/admin/maintenance?${params}`);
}
