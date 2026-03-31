export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSlackMention, sendSlack } from "@/backend/slack";
import { unauthorized } from "@/backend/api-response";

// 翌週月曜〜日曜の範囲を返す
function getNextWeekRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun
  const daysToNextMon = dow === 0 ? 1 : 8 - dow;

  const from = new Date(today);
  from.setDate(today.getDate() + daysToNextMon);

  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return { from, to, label: `${fmt(from)}〜${fmt(to)}` };
}

// GET /api/cron/weekly-schedule-reminder
// Vercel Cron から毎週日曜に呼ばれる（vercel.json で設定）
export async function GET(req: NextRequest) {
  // CRON_SECRET による認証（Vercel が Authorization: Bearer <secret> を付ける）
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const { from, to, label } = getNextWeekRange();

  // 全アクティブメンバーと userAccount.email を取得
  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      userAccount: { select: { email: true } },
    },
    orderBy: { name: "asc" },
  });

  // 翌週にスケジュールを1件でも登録済みのメンバーIDを取得
  const submitted = await prisma.workSchedule.findMany({
    where: {
      date: { gte: from, lte: to },
      memberId: { in: members.map((m) => m.id) },
    },
    select: { memberId: true },
    distinct: ["memberId"],
  });
  const submittedIds = new Set(submitted.map((s) => s.memberId));

  const unsubmitted = members.filter((m) => !submittedIds.has(m.id));

  if (unsubmitted.length === 0) {
    await sendSlack(
      `✅ 来週（${label}）の勤務予定が全員提出済みです。来週も頑張りましょう！`,
      "schedule"
    );
    return NextResponse.json({ ok: true, message: "全員提出済み" });
  }

  // Slack メンション文字列を並列取得
  const mentions = await Promise.all(
    unsubmitted.map((m) =>
      m.userAccount?.email
        ? getSlackMention(m.userAccount.email, m.name)
        : Promise.resolve(`*${m.name}*`)
    )
  );

  const text = [
    `📅 来週（${label}）の勤務予定が未提出のメンバーがいます。`,
    `勤怠ページから登録をお願いします。`,
    ``,
    `未提出 (${unsubmitted.length}名): ${mentions.join(" ")}`,
  ].join("\n");

  await sendSlack(text, "schedule");

  return NextResponse.json({ ok: true, notified: unsubmitted.length });
}
