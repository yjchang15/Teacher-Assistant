"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { newTeacherSession, teacherPinMatches, TEACHER_SESSION_COOKIE } from "@/lib/auth";

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next.slice(0, 500) : "/";
}

export async function loginTeacher(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (!teacherPinMatches(String(formData.get("pin") ?? "").trim())) {
    redirect(`/login?${new URLSearchParams({ error: "1", next }).toString()}`);
  }
  (await cookies()).set(TEACHER_SESSION_COOKIE, await newTeacherSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(next);
}

export async function logoutTeacher() {
  (await cookies()).delete(TEACHER_SESSION_COOKIE);
  redirect("/login");
}
