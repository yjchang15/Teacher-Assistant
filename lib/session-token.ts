export const TEACHER_SESSION_COOKIE = "teacher_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmac(secret: string, value: string, verify?: Uint8Array): Promise<Uint8Array | boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  if (verify) return crypto.subtle.verify("HMAC", key, verify as BufferSource, encoder.encode(value));
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function createTeacherSessionToken(secret: string): Promise<string> {
  const payload = encode(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  return `${payload}.${encode(await hmac(secret, payload) as Uint8Array)}`;
}

export async function verifyTeacherSessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    if (!(await hmac(secret, payload, decode(signature)))) return false;
    const parsed = JSON.parse(new TextDecoder().decode(decode(payload))) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function teacherAuthConfigured(): boolean {
  const pin = process.env.TEACHER_PIN?.trim() ?? "";
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  return pin.length >= 4 && secret.length >= 32;
}

export function allowUnconfiguredLocalAuth(): boolean {
  return process.env.NODE_ENV !== "production" && !teacherAuthConfigured();
}
