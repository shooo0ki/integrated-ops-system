export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { handleCallback } from "@/backend/google-calendar";
import { logger } from "@/backend/logger";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const code = req.nextUrl.searchParams.get("code");
  const returnedState = req.nextUrl.searchParams.get("state");
  const cookie = req.cookies.get(STATE_COOKIE)?.value;

  // Cookie から "state:memberId" を復元し、両方を検証
  const [savedState, savedMemberId] = cookie?.split(":") ?? [];
  if (!code || !returnedState || returnedState !== savedState || savedMemberId !== user.memberId) {
    const res = NextResponse.redirect(new URL("/mypage?gcal=error", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  try {
    await handleCallback(code, user.memberId);
    const res = NextResponse.redirect(new URL("/mypage?gcal=connected", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    logger.error("GoogleCallback", "OAuth callback failed", err);
    const res = NextResponse.redirect(new URL("/mypage?gcal=error", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  }
}
