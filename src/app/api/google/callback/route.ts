export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { handleCallback } from "@/backend/google-calendar";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || state !== user.memberId) {
    return NextResponse.redirect(new URL("/mypage?gcal=error", req.url));
  }

  try {
    await handleCallback(code, user.memberId);
    return NextResponse.redirect(new URL("/mypage?gcal=connected", req.url));
  } catch (err) {
    console.error("[GoogleCallback]", err);
    return NextResponse.redirect(new URL("/mypage?gcal=error", req.url));
  }
}
