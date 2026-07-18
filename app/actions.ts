"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AUTH_COOKIE, credentialsValid, sessionToken } from "@/lib/auth";
import * as db from "@/lib/queries";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const f = (fd: FormData, k: string, d = 0) => {
  const v = String(fd.get(k) ?? "").replace(/,/g, "").trim();
  return v === "" ? d : Number(v);
};

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
  redirect("/");
}

export async function logout() {
  const c = await cookies();
  c.delete(AUTH_COOKIE);
  redirect("/login");
}

// ── Notes (example) ───────────────────────────────────────────────────────────

export async function addNote(formData: FormData) {
  const title = s(formData, "title");
  if (title) await db.addNote({ title, body: s(formData, "body") });
  revalidatePath("/");
}

export async function deleteNote(formData: FormData) {
  await db.deleteNote(f(formData, "id"));
  revalidatePath("/");
}
