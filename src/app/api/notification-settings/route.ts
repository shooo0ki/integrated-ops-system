export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { unauthorized } from "@/backend/api-response";

// GET /api/notification-settings
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const setting = await prisma.notificationSetting.upsert({
    where: { memberId: user.memberId },
    create: { memberId: user.memberId },
    update: {},
    select: { clockReminder: true, closingReminder: true, scheduleReminder: true },
  });

  return NextResponse.json(setting);
}

// PUT /api/notification-settings
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const data: Record<string, boolean> = {};
  for (const key of ["clockReminder", "closingReminder", "scheduleReminder"] as const) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  const setting = await prisma.notificationSetting.upsert({
    where: { memberId: user.memberId },
    create: { memberId: user.memberId, ...data },
    update: data,
    select: { clockReminder: true, closingReminder: true, scheduleReminder: true },
  });

  return NextResponse.json(setting);
}
