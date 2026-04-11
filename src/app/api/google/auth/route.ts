export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { getAuthUrl } from "@/backend/google-calendar";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { url, state } = getAuthUrl();

  const res = NextResponse.redirect(url);

  // state + memberId をCookieに保存（5分有効、httpOnly）
  res.cookies.set(STATE_COOKIE, `${state}:${user.memberId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/callback",
    maxAge: 5 * 60,
  });

  return res;
}
