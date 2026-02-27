import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendSlack } from "@/lib/slack";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}

// ─── POST /api/attendances/clock-out ─────────────────────
// Body: { date: "YYYY-MM-DD", doneToday?: string, todoTomorrow?: string, breakMinutes?: number }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const date: string = body?.date;
  const doneToday: string = body?.doneToday ?? "";
  const todoTomorrow: string = body?.todoTomorrow ?? "";
  const breakMinutes: number = Number(body?.breakMinutes ?? 0);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "date が不正です" } }, { status: 400 });
  }

  const memberId = user.memberId;
  const now = new Date();

  const attendance = await prisma.attendance.findUnique({
    where: { memberId_date: { memberId, date: new Date(date) } },
  });

  if (!attendance || !attendance.clockIn) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "出勤記録が見つかりません" } },
      { status: 404 }
    );
  }

  // workMinutes 計算
  const clockInMs = attendance.clockIn.getTime();
  const clockOutMs = now.getTime();
  const workMinutes = Math.max(0, Math.round((clockOutMs - clockInMs) / 60000) - breakMinutes);

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      clockOut: now,
      breakMinutes,
      workMinutes,
      doneToday: doneToday || null,
      todoTomorrow: todoTomorrow || null,
    },
  });

  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateTimeStr = `${jst.toISOString().slice(0, 10)} ${jst.toISOString().slice(11, 16)}`;
  const lines = [
    `*${user.name}* :退勤を記録しました (${dateTimeStr})`,
    `おつかれさまでした！`,
  ];
  if (breakMinutes > 0) lines.push(`• 休憩時間: ${breakMinutes}分`);
  if (doneToday) lines.push(`• 日報: ${doneToday}`);
  await sendSlack(lines.join("\n"), "attendance");

  return NextResponse.json({
    id: updated.id,
    date,
    clockOut: updated.clockOut,
    workMinutes: updated.workMinutes,
    status: "done",
  });
}
