export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sendSlack } from "@/backend/slack";
import { unauthorized } from "@/backend/api-response";

// 翌週月曜〜日曜の範囲ラベルを返す
function getNextWeekLabel() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun, 6=Sat
  const daysToNextMon = dow === 0 ? 1 : 8 - dow;

  const from = new Date(today);
  from.setDate(today.getDate() + daysToNextMon);

  const to = new Date(from);
  to.setDate(from.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(from)}〜${fmt(to)}`;
}

// GET /api/cron/weekly-schedule-reminder
// Vercel Cron: 毎週土曜 18:00 JST (09:00 UTC)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const label = getNextWeekLabel();

  await sendSlack(
    `<!channel>\n📅 来週（${label}）の勤務予定を提出してください。\n勤務予定ページから登録をお願いします。`,
    "schedule"
  );

  return NextResponse.json({ ok: true });
}
