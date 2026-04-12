export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";

// PATCH /api/notifications/read — 通知を既読にする
// body: { id: string } or { all: true }
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);

  if (body?.all) {
    await prisma.notification.updateMany({
      where: { memberId: user.memberId, readAt: null },
      data: { readAt: new Date() },
    });
  } else if (body?.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, memberId: user.memberId },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
