// Edge-safe single-password auth (no node-only APIs — usable from proxy.ts).

export const AUTH_COOKIE = "ta_auth";
export const APP_USERNAME = process.env.APP_USERNAME || "admin";
export const APP_PASSWORD = process.env.APP_PASSWORD || "";
export const AUTH_ENABLED = Boolean(APP_PASSWORD);

const SECRET_KEY = process.env.SECRET_KEY || "dev-insecure-key-change-me";

// Deterministic session token derived from the secret + password.
// Computed identically in the Node (server action) and Edge (proxy) runtimes.
export async function sessionToken(): Promise<string> {
  const data = new TextEncoder().encode(`${SECRET_KEY}:${APP_PASSWORD}:ta-logged-in`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function credentialsValid(username: string, password: string): boolean {
  return username === APP_USERNAME && password === APP_PASSWORD;
}
