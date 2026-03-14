import { NextResponse } from "next/server";
import { getSession } from "@/backend/auth";

// Edge Runtime: コールドスタートなし、全世界のエッジノードで即時起動
export const runtime = "edge";

export async function GET() {
  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session.user });
}
