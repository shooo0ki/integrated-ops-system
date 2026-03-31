export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { getSlackUserId, sendSlackDM } from "@/backend/slack";
import { unauthorized, forbidden, apiError } from "@/backend/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin" && user.role !== "manager") {
    return forbidden();
  }

  const { month } = await req.json() as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return apiError("VALIDATION_ERROR", "month は YYYY-MM 形式で指定してください", 400);
  }

  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

  // サマリーとメンバー情報を並列取得（attendance 全行 scan を排除）
  const [member, summary, scheduledDays] = await Promise.all([
    prisma.member.findUnique({
      where: { id: params.memberId },
      select: { name: true, userAccount: { select: { email: true } } },
    }),
    prisma.monthlyAttendanceSummary.findUnique({
      where: { memberId_targetMonth: { memberId: params.memberId, targetMonth: month } },
      select: { workDays: true, totalMinutes: true },
    }),
    prisma.workSchedule.count({
      where: {
        memberId: params.memberId,
        date: { gte: monthStart, lte: monthEnd },
        isOff: false,
      },
    }),
  ]);

  if (!member) {
    return apiError("NOT_FOUND", "メンバーが見つかりません", 404);
  }

  const workingDays = summary?.workDays ?? 0;
  const totalHours = ((summary?.totalMinutes ?? 0) / 60).toFixed(1);
  const missingDays = Math.max(0, scheduledDays - workingDays);

  const yearStr = String(year);
  const monStr = String(mon).padStart(2, "0");

  const lines: string[] = [
    "【勤怠確認依頼】",
    `${member.name} さん、${yearStr}年${monStr}月分の勤怠確認をお願いします。`,
    "",
    `📅 稼働日数: ${workingDays}日`,
    `⏱ 合計時間: ${totalHours}h`,
    `⚠️ 未打刻: ${missingDays}日`,
    "",
    "勤怠ページから確認・申請してください。",
  ];

  const slackUserId = member.userAccount?.email
    ? await getSlackUserId(member.userAccount.email)
    : null;
  await sendSlackDM(slackUserId, lines.join("\n"));

  await prisma.attendance.updateMany({
    where: {
      memberId: params.memberId,
      date: { gte: monthStart, lte: monthEnd },
    },
    data: { slackNotified: true },
  });

  return NextResponse.json({ ok: true });
}
