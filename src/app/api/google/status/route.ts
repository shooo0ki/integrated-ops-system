export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { isConnected } from "@/backend/google-calendar";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  return NextResponse.json({ connected: await isConnected(user.memberId) });
}
