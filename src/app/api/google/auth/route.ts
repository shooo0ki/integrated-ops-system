export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { getAuthUrl } from "@/backend/google-calendar";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = getAuthUrl(user.memberId);
  return NextResponse.redirect(url);
}
