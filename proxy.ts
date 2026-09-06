import { NextRequest, NextResponse } from "next/server";
import {
  allowUnconfiguredLocalAuth,
  TEACHER_SESSION_COOKIE,
  verifyTeacherSessionToken,
} from "@/lib/session-token";

const publicApi = new Set(["/api/classes", "/api/articles", "/api/records", "/api/chat"]);

function isPublic(path: string): boolean {
  if (path === "/login") return true;
  if (publicApi.has(path)) return true;
  if (path === "/speaking" || path === "/speaking/index.html") return true;
  if (path.startsWith("/speaking/") && path !== "/speaking/teacher.html") return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isPublic(path) || allowUnconfiguredLocalAuth()) return NextResponse.next();

  const authenticated = await verifyTeacherSessionToken(
    request.cookies.get(TEACHER_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET?.trim() ?? "",
  );
  if (authenticated) {
    if (path === "/login") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
