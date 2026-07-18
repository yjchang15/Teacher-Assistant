import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED, AUTH_COOKIE, sessionToken } from "@/lib/auth";

// Only the teacher back-office (/admin) is gated. The 小老師 登記頁 and /login
// stay public. When APP_PASSWORD is unset, auth is off and everything is open.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (!AUTH_ENABLED) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const token = await sessionToken();
  if (cookie === token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
