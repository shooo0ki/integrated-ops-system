import { NextRequest, NextResponse } from "next/server";

// Better Auth の Cookie 名 (advanced.cookiePrefix: "salt2" → "salt2.session_token")
const SESSION_COOKIE = "salt2.session_token";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/api/warmup",
  "/api/cron/",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Cookie の存在チェックのみ (認証判定はしない — CVE-2025-29927 対策)
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
