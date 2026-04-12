export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { sendSlack, getSlackMention } from "@/backend/slack";
import { recalcAttendanceSummary } from "@/backend/attendance-summary";


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
  const workLogs: { projectId: string; hours: number; note?: string }[] = Array.isArray(body?.workLogs) ? body.workLogs : [];

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

  // workLogs 保存（既存を削除して再作成）
  if (workLogs.length > 0) {
    await prisma.attendanceWorkLog.deleteMany({ where: { attendanceId: attendance.id } });
    await prisma.attendanceWorkLog.createMany({
      data: workLogs
        .filter((l) => l.projectId && l.hours > 0)
        .map((l) => ({
          attendanceId: attendance.id,
          projectId: l.projectId,
          hours: Math.round(l.hours * 2) / 2, // 0.5h 刻みに丸め
          note: l.note?.trim() || null,
        })),
    });
  }

  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateTimeStr = `${jst.toISOString().slice(0, 10)} ${jst.toISOString().slice(11, 16)}`;
  const mention = await getSlackMention(user.email, user.name);
  const lines = [
    `${mention} :退勤を記録しました (${dateTimeStr})`,
    `おつかれさまでした！`,
  ];
  lines.push(`• 休憩時間: ${breakMinutes}分`);
  if (workLogs.length > 0) {
    // workLogs のPJ名を取得して Slack に含める
    const projects = await prisma.project.findMany({
      where: { id: { in: workLogs.map((l) => l.projectId) } },
      select: { id: true, name: true },
    });
    const pjMap = new Map(projects.map((p) => [p.id, p.name]));
    lines.push(`• 工数:`);
    for (const l of workLogs.filter((l) => l.hours > 0)) {
      const pjName = pjMap.get(l.projectId) ?? "不明";
      lines.push(`  - ${pjName}: ${l.hours}h${l.note ? ` (${l.note})` : ""}`);
    }
  }
  if (doneToday) lines.push(`• 日報: ${doneToday}`);
  if (todoTomorrow) lines.push(`• 次回勤務日にやること: ${todoTomorrow}`);
  await Promise.all([
    sendSlack(lines.join("\n"), "attendance"),
    recalcAttendanceSummary(user.memberId, date.slice(0, 7)),
  ]);

  return NextResponse.json({
    id: updated.id,
    date,
    clockOut: updated.clockOut,
    workMinutes: updated.workMinutes,
    status: "done",
  });
}
