export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";
import { disconnect } from "@/backend/google-calendar";

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await disconnect(user.memberId);
  return NextResponse.json({ ok: true });
}
