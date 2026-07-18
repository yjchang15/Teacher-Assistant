import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED, AUTH_COOKIE, sessionToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (!AUTH_ENABLED) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const token = await sessionToken();
  if (cookie === token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Protect everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
