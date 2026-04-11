import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/backend/rate-limit";

// Better Auth の Cookie 名
// ローカル(HTTP): "salt2.session_token", 本番(HTTPS): "__Secure-salt2.session_token"
const SESSION_COOKIES = ["salt2.session_token", "__Secure-salt2.session_token"];

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/api/warmup",
  "/api/cron/",
];

// レート制限対象のルート定義
const RATE_LIMIT_RULES: {
  match: (pathname: string, method: string) => boolean;
  limit: number;
  windowMs: number;
}[] = [
  {
    // ログイン: IP あたり 5回/15分
    match: (p, m) => m === "POST" && p.startsWith("/api/auth/sign-in"),
    limit: 5,
    windowMs: 15 * 60 * 1000,
  },
  {
    // サインアップ: IP あたり 3回/15分
    match: (p, m) => m === "POST" && p.startsWith("/api/auth/sign-up"),
    limit: 3,
    windowMs: 15 * 60 * 1000,
  },
  {
    // パスワード変更: IP あたり 3回/60分
    match: (p, m) => m === "PUT" && /^\/api\/members\/[^/]+\/profile\/password$/.test(p),
    limit: 3,
    windowMs: 60 * 60 * 1000,
  },
];

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // レート制限チェック（認証・非認証問わず対象パスに適用）
  const ip = getClientIp(req);
  for (const rule of RATE_LIMIT_RULES) {
    if (rule.match(pathname, method)) {
      const key = `${ip}:${pathname}`;
      const result = rateLimit(key, rule.limit, rule.windowMs);
      if (result.limited) {
        return NextResponse.json(
          { error: { code: "RATE_LIMITED", message: "リクエスト回数の上限に達しました。しばらく時間をおいてお試しください。" } },
          { status: 429 },
        );
      }
      break;
    }
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Cookie の存在チェックのみ (認証判定はしない — CVE-2025-29927 対策)
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
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
