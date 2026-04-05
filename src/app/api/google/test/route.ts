export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { prisma } from "@/backend/db";
import { OAuth2Client } from "google-auth-library";

// GET /api/google/test — Google Calendar 連携のデバッグ用
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // 1. トークン確認
  const token = await prisma.googleToken.findUnique({
    where: { memberId: user.memberId },
  });

  if (!token) {
    return NextResponse.json({ error: "GoogleToken not found", memberId: user.memberId });
  }

  // 2. アクセストークン有効性チェック & リフレッシュ
  let accessToken = token.accessToken;
  const tokenInfo: Record<string, unknown> = {
    hasRefreshToken: !!token.refreshToken,
    expiresAt: token.expiresAt.toISOString(),
    isExpired: token.expiresAt.getTime() < Date.now(),
  };

  if (token.expiresAt.getTime() < Date.now() + 60_000) {
    try {
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );
      client.setCredentials({ refresh_token: token.refreshToken });
      const { credentials } = await client.refreshAccessToken();
      accessToken = credentials.access_token ?? accessToken;
      tokenInfo.refreshed = true;

      await prisma.googleToken.update({
        where: { memberId: user.memberId },
        data: {
          accessToken,
          expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
        },
      });
    } catch (err) {
      return NextResponse.json({
        error: "Token refresh failed",
        detail: err instanceof Error ? err.message : String(err),
        tokenInfo,
      });
    }
  }

  // 3. Calendar API テスト呼び出し
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const body = await res.text();

    if (!res.ok) {
      return NextResponse.json({
        error: "Calendar API failed",
        status: res.status,
        body,
        tokenInfo,
        envCheck: {
          hasClientId: !!process.env.GOOGLE_CLIENT_ID,
          hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
          redirectUri: process.env.GOOGLE_REDIRECT_URI,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Google Calendar API is working",
      tokenInfo,
      calendarResponse: JSON.parse(body).summary,
    });
  } catch (err) {
    return NextResponse.json({
      error: "Fetch failed",
      detail: err instanceof Error ? err.message : String(err),
      tokenInfo,
    });
  }
}
