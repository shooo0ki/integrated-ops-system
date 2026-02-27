import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSlackUserId, sendSlackDM } from "@/lib/slack";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month } = await req.json() as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month は YYYY-MM 形式で指定してください" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);

  const [member, attendances] = await Promise.all([
    prisma.member.findUnique({
      where: { id: params.memberId },
      select: { name: true, userAccount: { select: { email: true } } },
    }),
    prisma.attendance.findMany({
      where: {
        memberId: params.memberId,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: {
        clockIn: true,
        clockOut: true,
        workMinutes: true,
        status: true,
      },
    }),
  ]);

  if (!member) {
    return NextResponse.json({ error: "メンバーが見つかりません" }, { status: 404 });
  }

  const workingDays = attendances.filter((a) => a.status !== "absent").length;
  const totalMinutes = attendances.reduce((sum, a) => sum + (a.workMinutes ?? 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const missingDays = attendances.filter(
    (a) => a.status !== "absent" && (!a.clockIn || !a.clockOut)
  ).length;

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
