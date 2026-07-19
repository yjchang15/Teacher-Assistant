import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (session.mustChange && pathname !== "/password") return NextResponse.redirect(new URL("/password", req.url));
  if (pathname.startsWith("/admin/accounts") && session.role !== "admin") return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
