import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  allowUnconfiguredLocalAuth,
  createTeacherSessionToken,
  teacherAuthConfigured,
  TEACHER_SESSION_COOKIE,
  verifyTeacherSessionToken,
} from "./session-token";

export { TEACHER_SESSION_COOKIE, teacherAuthConfigured };

export function teacherPinMatches(value: string): boolean {
  const expected = process.env.TEACHER_PIN?.trim() ?? "";
  if (!expected || !teacherAuthConfigured()) return false;
  const left = createHash("sha256").update(value).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function isTeacherAuthenticated(): Promise<boolean> {
  if (allowUnconfiguredLocalAuth()) return true;
  const token = (await cookies()).get(TEACHER_SESSION_COOKIE)?.value;
  return verifyTeacherSessionToken(token, process.env.SESSION_SECRET?.trim() ?? "");
}

export async function newTeacherSession(): Promise<string> {
  return createTeacherSessionToken(process.env.SESSION_SECRET?.trim() ?? "");
}
