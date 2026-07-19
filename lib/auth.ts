export const AUTH_COOKIE = "ta_session";
export const APP_USERNAME = process.env.APP_USERNAME || "admin";
export const APP_PASSWORD = process.env.APP_PASSWORD || "change-me";
const SECRET_KEY = process.env.SECRET_KEY || "dev-insecure-key-change-me";

export type SessionPayload = { id: number; code: string; role: "admin" | "class"; classId: number | null; mustChange: boolean };

function bytesToHex(bytes: Uint8Array) { return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function base64url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function fromBase64url(value: string) {
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export async function passwordHash(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${SECRET_KEY}:password:${password}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

async function signature(body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))));
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${await signature(body)}`;
}

export async function verifySessionToken(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || sig !== await signature(body)) return null;
  try { return JSON.parse(fromBase64url(body)) as SessionPayload; } catch { return null; }
}
