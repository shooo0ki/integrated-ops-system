export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { sendSlackDM, getSlackUserId } from "@/backend/slack";
import { sendEmail } from "@/backend/email";
import { unauthorized } from "@/backend/api-response";

// GET /api/cron/clock-reminder
// Vercel Cron: 毎日 10:00 JST (01:00 UTC)
// 今日の勤務予定があるのに未打刻のメンバーに通知
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  // 今日の日付（JST）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jst.toISOString().slice(0, 10);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
  const todayEnd = new Date(`${todayStr}T23:59:59+09:00`);

  // 今日の勤務予定（isOff: false）があり、clockReminder有効なメンバー
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
      attendances: {
        where: { date: { gte: todayStart, lte: todayEnd } },
        select: { clockIn: true },
        take: 1,
      },
    },
  });

  const noClockIn = members.filter((m) => !m.attendances[0]?.clockIn);

  if (noClockIn.length === 0) {
    return NextResponse.json({ ok: true, message: "対象者なし" });
  }

  const message = "出勤打刻がまだのようです。打刻をお願いします。";

  await Promise.all(
    noClockIn.map(async (m) => {
      const email = m.userAccount?.email;
      if (!email) return;

      const slackUserId = await getSlackUserId(email);
      if (slackUserId) {
        await sendSlackDM(slackUserId, `⏰ ${m.name}さん、${message}`);
      }

      await sendEmail({
        to: email,
        subject: "【打刻リマインド】出勤打刻をお願いします",
        text: `${m.name}さん\n\n${message}\n\n勤怠ページから打刻してください。`,
      });
    })
  );

  return NextResponse.json({ ok: true, notified: noClockIn.length });
}
