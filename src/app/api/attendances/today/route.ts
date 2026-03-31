export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";


// ─── GET /api/attendances/today ───────────────────────────
// 自分の今日の勤怠を返す
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const now = new Date();
  // JST 基準で「今日」の日付を求める（UTC との差分 +9h で UTC 日付コンポーネントを使用）
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(jstNow.getUTCDate()).padStart(2, "0")}`;
  const today = new Date(`${dateStr}T00:00:00Z`); // UTC midnight — clock-in と同じ形式

  // 今日のレコード + 未退勤の直近レコードを並列取得
  const [todayRec, openRec] = await Promise.all([
    prisma.attendance.findUnique({
      where: { memberId_date: { memberId: user.memberId, date: today } },
    }),
    // 日またぎ対応: clockIn済み・clockOut未済の直近レコードを探す
    prisma.attendance.findFirst({
      where: {
        memberId: user.memberId,
        clockIn: { not: null },
        clockOut: null,
        date: { lt: today },
      },
      orderBy: { date: "desc" },
    }),
  ]);
  // 今日のレコードがあればそれを優先、なければ未退勤の過去レコードを表示
  const attendance = todayRec ?? openRec ?? null;

  if (!attendance) {
    return NextResponse.json(null);
  }

  // status 判定
  let status: string;
  if (attendance.clockOut) {
    status = "done";
  } else if (attendance.clockIn) {
    status = "working";
  } else {
    status = "not_started";
  }

  return NextResponse.json({
    id: attendance.id,
    date: attendance.date.toISOString().slice(0, 10), // 日またぎ時は昨日の日付を返す
    clockIn: attendance.clockIn
      ? (() => { const jst = new Date(attendance.clockIn.getTime() + 9 * 60 * 60 * 1000); return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`; })()
      : null,
    clockOut: attendance.clockOut
      ? (() => { const jst = new Date(attendance.clockOut.getTime() + 9 * 60 * 60 * 1000); return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`; })()
      : null,
    breakMinutes: attendance.breakMinutes,
    todoToday: attendance.todoToday,
    doneToday: attendance.doneToday,
    todoTomorrow: attendance.todoTomorrow,
    locationType: attendance.locationType,
    status,
  });
}
