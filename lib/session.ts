import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, verifySessionToken } from "./auth";
import { getAccountById } from "./queries";

// One user, one role: a valid session cookie is full access.
export async function currentAccount() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return await getAccountById(payload.id);
}

export async function requireAccount() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}
