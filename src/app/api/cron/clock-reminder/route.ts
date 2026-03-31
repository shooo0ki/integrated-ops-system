export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { sendSlackDM, getSlackUserId } from "@/backend/slack";
import { sendEmail } from "@/backend/email";
import { unauthorized } from "@/backend/api-response";

// GET /api/cron/clock-reminder
// Vercel Cron: 毎時実行（JST 8:00-15:00 = UTC 23:00-6:00）
// 勤務開始予定を1時間過ぎても未打刻のメンバーに通知
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  // 現在時刻（JST）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentHour = jst.getHours();
  const todayStr = jst.toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
  const todayEnd = new Date(`${todayStr}T23:59:59+09:00`);

  // 今日の勤務予定があり、clockReminder有効なメンバー
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      leftAt: null,
      OR: [
        { notificationSetting: { clockReminder: true } },
        { notificationSetting: null },
      ],
      workSchedules: {
        some: { date: todayDate, isOff: false },
      },
    },
    select: {
      id: true,
      name: true,
      userAccount: { select: { email: true } },
      workSchedules: {
        where: { date: todayDate, isOff: false },
        select: { startTime: true },
        take: 1,
      },
      attendances: {
        where: { date: { gte: todayStart, lte: todayEnd } },
        select: { clockIn: true },
        take: 1,
      },
    },
  });

  // 「開始予定の1時間後 == 現在の時間帯」のメンバーだけ通知
  // 例: startTime "09:00" → 10時台にリマインド, "13:30" → 14時台にリマインド
  const targets = members.filter((m) => {
    if (m.attendances[0]?.clockIn) return false; // 打刻済み
    const startTime = m.workSchedules[0]?.startTime;
    if (!startTime) return false;
    const startHour = parseInt(startTime.split(":")[0], 10);
    return currentHour === startHour + 1;
  });

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, message: "対象者なし" });
  }

  await Promise.all(
    targets.map(async (m) => {
      const email = m.userAccount?.email;
      if (!email) return;
      const startTime = m.workSchedules[0]?.startTime ?? "";

      const slackUserId = await getSlackUserId(email);
      if (slackUserId) {
        await sendSlackDM(
          slackUserId,
          `⏰ ${m.name}さん、${startTime}が出勤予定ですが打刻がまだのようです。打刻をお願いします。`
        );
      }

      await sendEmail({
        to: email,
        subject: "【打刻リマインド】出勤打刻をお願いします",
        text: `${m.name}さん\n\n本日${startTime}が出勤予定ですが、打刻がまだのようです。\n勤怠ページから打刻してください。`,
      });
    })
  );

  return NextResponse.json({ ok: true, notified: targets.length });
}
