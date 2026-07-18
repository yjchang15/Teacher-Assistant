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
  if (date && subject) await db.addRecords(date, subject, seats);
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
}
