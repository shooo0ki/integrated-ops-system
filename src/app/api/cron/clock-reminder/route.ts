export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { sendSlack, getSlackMention } from "@/backend/slack";
import { unauthorized } from "@/backend/api-response";

// GET /api/cron/clock-reminder
// Vercel Cron: 毎日 JST 10:00 (UTC 01:00) に1回実行
// 勤務開始予定を過ぎても未打刻のメンバーをまとめて通知
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  // 現在時刻（JST）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
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

  // 勤務開始予定時刻を過ぎていて未打刻のメンバーを抽出
  const currentMinutes = jst.getHours() * 60 + jst.getMinutes();
  const targets = members.filter((m) => {
    if (m.attendances[0]?.clockIn) return false;
    const startTime = m.workSchedules[0]?.startTime;
    if (!startTime) return false;
    const [h, min] = startTime.split(":").map(Number);
    return currentMinutes >= h * 60 + min;
  });

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, message: "対象者なし" });
  }

  // メンション文字列を並列取得
  const mentions = await Promise.all(
    targets.map(async (m) => {
      const email = m.userAccount?.email;
      const mention = email ? await getSlackMention(email, m.name) : `*${m.name}*`;
      const startTime = m.workSchedules[0]?.startTime ?? "";
      return `${mention}（予定${startTime}）`;
    })
  );

  // 勤怠チャンネルに1投稿でまとめて通知
  await sendSlack(
    `⏰ 出勤予定時刻を過ぎていますが打刻がまだのメンバーがいます。打刻をお願いします。\n\n${mentions.join("\n")}`,
    "attendance"
  );

  return NextResponse.json({ ok: true, notified: targets.length });
}
