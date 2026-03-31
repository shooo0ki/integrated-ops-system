export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/backend/auth";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
