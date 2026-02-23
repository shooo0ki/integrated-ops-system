import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}

// ─── POST /api/attendances/clock-in ──────────────────────
// Body: { date: "YYYY-MM-DD", todoToday: string }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const date: string = body?.date;
  const todoToday: string = body?.todoToday ?? "";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "date が不正です" } }, { status: 400 });
  }

  const memberId = user.memberId;
  const now = new Date();

  const attendance = await prisma.attendance.upsert({
    where: { memberId_date: { memberId, date: new Date(date) } },
    create: {
      memberId,
      date: new Date(date),
      clockIn: now,
      todoToday: todoToday || null,
    },
    update: {
      // 既に出勤済みの場合は上書きしない
      todoToday: todoToday || undefined,
    },
  });

  // clockIn がまだ設定されていなかった場合のみ update
  if (!attendance.clockIn || attendance.clockIn > now) {
    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { clockIn: now, todoToday: todoToday || null },
    });
  }

  return NextResponse.json({
    id: attendance.id,
    date,
    clockIn: attendance.clockIn ?? now,
    status: "working",
  });
}
