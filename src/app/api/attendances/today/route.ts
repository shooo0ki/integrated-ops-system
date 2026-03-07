import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}

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

  // 今日と昨日を並列取得（日またぎ継続勤務のため）
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const [todayRec, prevRec] = await Promise.all([
    prisma.attendance.findUnique({
      where: { memberId_date: { memberId: user.memberId, date: today } },
    }),
    prisma.attendance.findUnique({
      where: { memberId_date: { memberId: user.memberId, date: yesterday } },
    }),
  ]);
  // 日またぎ対応:
  //   - prevRec に clockIn があり clockOut がない → 昨日から継続勤務中
  //   - prevRec の clockOut が JST今日の00:00以降 かつ JST 8:00未満 → 日またぎ退勤済み表示（早朝のみ）
  //     JST 8:00以降は新しい勤務日として扱い、今日の出勤を可能にする
  const jstTodayMidnight = new Date(today.getTime() - 9 * 60 * 60 * 1000);
  const jstHour = jstNow.getUTCHours(); // jstNow は UTC+9 済みなので UTCHours = JST hours
  const isEarlyMorning = jstHour < 8;
  const prevDayActive =
    prevRec?.clockIn &&
    (!prevRec.clockOut || // 昨日出勤で未退勤（継続勤務中）
     (prevRec.clockOut >= jstTodayMidnight && isEarlyMorning)); // 日またぎ退勤済み（8時前のみ）
  const attendance = todayRec ?? (prevDayActive ? prevRec : null);

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
