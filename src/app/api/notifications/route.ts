export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSessionUser } from "@/backend/auth";
import { unauthorized } from "@/backend/api-response";

// GET /api/notifications — 自分宛の通知一覧（最新50件）
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const notifications = await prisma.notification.findMany({
    where: { memberId: user.memberId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });

  const unreadCount = await prisma.notification.count({
    where: { memberId: user.memberId, readAt: null },
  });

  return NextResponse.json({ notifications, unreadCount });
}
