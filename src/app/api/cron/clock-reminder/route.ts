export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { sendSlackDM, getSlackUserId, sendSlack } from "@/backend/slack";
import { sendEmail } from "@/backend/email";
import { unauthorized } from "@/backend/api-response";

// GET /api/cron/clock-reminder
// Vercel Cron: 平日 10:00 JST (01:00 UTC)
// 出勤打刻忘れのメンバーにSlack DM + メールを送信
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
  const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
  const todayEnd = new Date(`${todayStr}T23:59:59+09:00`);

  // 土日はスキップ
  const dow = jst.getDay();
  if (dow === 0 || dow === 6) {
    return NextResponse.json({ ok: true, message: "weekend, skipped" });
  }

  // clockReminder が有効（設定なし=デフォルトON も含む）なアクティブメンバー
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      leftAt: null,
      OR: [
        { notificationSetting: { clockReminder: true } },
        { notificationSetting: null },
      ],
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
    return NextResponse.json({ ok: true, message: "全員打刻済み" });
  }

  const message = "出勤打刻がまだのようです。打刻をお願いします。";

  await Promise.all(
    noClockIn.map(async (m) => {
      const email = m.userAccount?.email;
      // Slack DM
      if (email) {
        const slackUserId = await getSlackUserId(email);
        if (slackUserId) {
          await sendSlackDM(slackUserId, `⏰ ${m.name}さん、${message}`);
        }
      }
      // メール
      if (email) {
        await sendEmail({
          to: email,
          subject: "【打刻リマインド】出勤打刻をお願いします",
          text: `${m.name}さん\n\n${message}\n\n勤怠ページから打刻してください。`,
        });
      }
    })
  );

  return NextResponse.json({ ok: true, notified: noClockIn.length });
}
