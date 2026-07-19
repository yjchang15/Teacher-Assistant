import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, verifySessionToken } from "./auth";
import { getAccountById } from "./queries";

export async function currentAccount() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const account = await getAccountById(payload.id);
  return account?.active ? account : null;
}
export async function requireAccount(allowPasswordChange = false) { const account = await currentAccount(); if (!account) redirect("/login"); if (account.must_change_password && !allowPasswordChange) redirect("/password"); return account; }
export async function requireAdmin() { const account = await requireAccount(); if (account.role !== "admin") redirect("/"); return account; }
