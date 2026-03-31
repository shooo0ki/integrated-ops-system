export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { sendSlack, sendSlackDM, getSlackUserId } from "@/backend/slack";
import { sendEmail } from "@/backend/email";
import { unauthorized } from "@/backend/api-response";

// 翌週月曜〜日曜の範囲を返す
function getNextWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun, 6=Sat
  const daysToNextMon = dow === 0 ? 1 : 8 - dow;

  const from = new Date(today);
  from.setDate(today.getDate() + daysToNextMon);

  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return { from, to, label: `${fmt(from)}〜${fmt(to)}` };
}

// GET /api/cron/weekly-schedule-reminder
// Vercel Cron: 毎週土曜 18:00 JST (09:00 UTC)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const { from, to, label } = getNextWeekRange();

  // チャンネルへの @channel 投稿
  await sendSlack(
    `<!channel>\n📅 来週（${label}）の勤務予定を提出してください。\n勤務予定ページから登録をお願いします。`,
    "schedule"
  );

  // scheduleReminder が有効なメンバーで未提出者に個別通知
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      leftAt: null,
      OR: [
        { notificationSetting: { scheduleReminder: true } },
        { notificationSetting: null },
      ],
    },
    select: {
      id: true,
      name: true,
      userAccount: { select: { email: true } },
      workSchedules: {
        where: { date: { gte: from, lte: to } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const noSchedule = members.filter((m) => m.workSchedules.length === 0);

  await Promise.all(
    noSchedule.map(async (m) => {
      const email = m.userAccount?.email;
      if (!email) return;

      const slackUserId = await getSlackUserId(email);
      if (slackUserId) {
        await sendSlackDM(
          slackUserId,
          `📅 ${m.name}さん、来週（${label}）の勤務予定が未登録です。登録をお願いします。`
        );
      }

      await sendEmail({
        to: email,
        subject: `【勤務予定リマインド】来週（${label}）の予定を登録してください`,
        text: `${m.name}さん\n\n来週（${label}）の勤務予定が未登録です。\n勤務予定ページから登録をお願いします。`,
      });
    })
  );

  return NextResponse.json({ ok: true, notified: noSchedule.length });
}
