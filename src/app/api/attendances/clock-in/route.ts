export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { sendSlack, getSlackMention } from "@/backend/slack";
import { recalcAttendanceSummary } from "@/backend/attendance-summary";


// ─── POST /api/attendances/clock-in ──────────────────────
// Body: { date: "YYYY-MM-DD", todoToday: string, locationType?: string }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const date: string = body?.date;
  const todoToday: string = body?.todoToday ?? "";
  const locationType: string = body?.locationType ?? "office";

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
      locationType,
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
      data: { clockIn: now, todoToday: todoToday || null, locationType },
    });
  }

  // サマリー更新 & Slack 通知は並列実行
  const targetMonth = date.slice(0, 7);
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateTimeStr = `${jst.toISOString().slice(0, 10)} ${jst.toISOString().slice(11, 16)}`;
  const mention = await getSlackMention(user.email, user.name);
  const lines = [`${mention} :出勤を記録しました (${dateTimeStr})`];
  if (todoToday) lines.push(`• 今日の予定: ${todoToday}`);
  await Promise.all([
    sendSlack(lines.join("\n"), "attendance"),
    recalcAttendanceSummary(memberId, targetMonth),
  ]);

  return NextResponse.json({
    id: attendance.id,
    date,
    clockIn: attendance.clockIn ?? now,
    status: "working",
  });
}
