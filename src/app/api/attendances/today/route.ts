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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.findUnique({
    where: { memberId_date: { memberId: user.memberId, date: today } },
  });

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
    date: today.toISOString().slice(0, 10),
    clockIn: attendance.clockIn
      ? `${String(attendance.clockIn.getHours()).padStart(2, "0")}:${String(attendance.clockIn.getMinutes()).padStart(2, "0")}`
      : null,
    clockOut: attendance.clockOut
      ? `${String(attendance.clockOut.getHours()).padStart(2, "0")}:${String(attendance.clockOut.getMinutes()).padStart(2, "0")}`
      : null,
    breakMinutes: attendance.breakMinutes,
    todoToday: attendance.todoToday,
    doneToday: attendance.doneToday,
    todoTomorrow: attendance.todoTomorrow,
    status,
  });
}
