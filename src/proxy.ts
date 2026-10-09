import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "sos_session";

/**
 * Redirect convenience only. This checks that a session cookie is present but
 * does not validate it, and deliberately imports no server modules, because
 * proxy can run outside the app runtime. Every route handler re-checks the
 * session and the resource owner before acting, so authorization never depends
 * on this file.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminArea && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};