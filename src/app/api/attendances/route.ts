export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { recalcAttendanceSummary } from "@/backend/attendance-summary";


function toTimeStr(dt: Date | null): string | null {
  if (!dt) return null;
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

function parseTimeOnDate(baseDate: Date, timeStr: string | null): Date | null {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [h, m] = timeStr.split(":").map(Number);
  // baseDate は UTC midnight。JST midnight = baseDate - 9h
  // ユーザー入力 h:m は JST なので UTC に変換: jstMidnight + h:m
  const jstMidnightMs = baseDate.getTime() - 9 * 60 * 60 * 1000;
  return new Date(jstMidnightMs + h * 60 * 60 * 1000 + m * 60 * 1000);
}

// ─── GET /api/attendances?memberId=&month=YYYY-MM ─────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId") ?? user.memberId;
  const month = searchParams.get("month") ?? (() => {
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  // 他人のデータは admin/manager のみ
  if (memberId !== user.memberId && !["admin", "manager"].includes(user.role)) {
    return forbidden();
  }

  const monthStart = new Date(`${month}-01`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  const records = await prisma.attendance.findMany({
    where: {
      memberId,
      date: { gte: monthStart, lte: monthEnd },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    records.map((r) => {
      // workMinutes が計算済みなら使う、なければ clockIn/Out から計算
      let actualHours: number | null = null;
      if (r.workMinutes != null) {
        actualHours = Math.round((r.workMinutes / 60) * 10) / 10;
      } else if (r.clockIn && r.clockOut) {
        const mins = Math.round((r.clockOut.getTime() - r.clockIn.getTime()) / 60000) - r.breakMinutes;
        actualHours = Math.round((Math.max(0, mins) / 60) * 10) / 10;
      }

      // status 判定（DB status は 'normal'|'modified'|'absent'）
      let displayStatus: string;
      if (r.status === "modified" && r.confirmStatus === "unconfirmed") {
        displayStatus = "pending_approval";
      } else if (r.status === "absent") {
        displayStatus = "absent";
      } else if (r.clockOut) {
        displayStatus = "done";
      } else if (r.clockIn) {
        displayStatus = "working";
      } else {
        displayStatus = "not_started";
      }

      return {
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        clockIn: toTimeStr(r.clockIn),
        clockOut: toTimeStr(r.clockOut),
        breakMinutes: r.breakMinutes,
        actualHours,
        status: displayStatus,
        confirmStatus: r.confirmStatus,
        todoToday: r.todoToday,
        doneToday: r.doneToday,
        todoTomorrow: r.todoTomorrow,
        isModified: r.status === "modified",
      };
    }),

  );
}

// ─── POST /api/attendances ─────────────────────────────────
// 本人: 打刻記録がない日に新規申請（status='modified', confirmStatus='unconfirmed'）
// admin/manager: 任意メンバーの日付を指定して新規作成
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "リクエストボディが不正です" } }, { status: 400 });
  }

  const isAdminOrManager = ["admin", "manager"].includes(user.role);
  const memberId = (isAdminOrManager && body.memberId) ? body.memberId : user.memberId;

  if (!memberId) return unauthorized();

  // 自分以外のデータは admin/manager のみ
  if (memberId !== user.memberId && !isAdminOrManager) return forbidden();

  const { date, clockIn, clockOut, breakMinutes } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "date は YYYY-MM-DD 形式で指定してください" } },
      { status: 400 }
    );
  }

  const dateObj = new Date(`${date}T00:00:00`);

  // 同日のレコードが既にある場合は拒否
  const existing = await prisma.attendance.findFirst({
    where: { memberId, date: dateObj },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "該当日の勤怠記録が既に存在します。修正申請を使用してください。" } },
      { status: 409 }
    );
  }

  const newClockIn = parseTimeOnDate(dateObj, clockIn ?? null);
  // 日またぎ対応: clockOut が clockIn より前なら翌日扱い（例: 出勤22:00 → 退勤04:00）
  let newClockOut = parseTimeOnDate(dateObj, clockOut ?? null);
  if (newClockIn && newClockOut && newClockOut <= newClockIn) {
    newClockOut = new Date(newClockOut.getTime() + 24 * 60 * 60 * 1000);
  }
  const breaks = Math.max(0, Number(breakMinutes ?? 0));

  let workMinutes: number | undefined;
  if (newClockIn && newClockOut) {
    workMinutes = Math.max(0, Math.round((newClockOut.getTime() - newClockIn.getTime()) / 60000) - breaks);
  }

  const created = await prisma.attendance.create({
    data: {
      memberId,
      date: dateObj,
      clockIn: newClockIn,
      clockOut: newClockOut,
      breakMinutes: breaks,
      ...(workMinutes !== undefined ? { workMinutes } : {}),
      status: "modified",
      confirmStatus: "unconfirmed",
    },
  });

  await recalcAttendanceSummary(memberId, date.slice(0, 7));

  const actualHours = created.workMinutes != null
    ? Math.round((created.workMinutes / 60) * 10) / 10
    : null;

  return NextResponse.json({
    id: created.id,
    date: created.date.toISOString().slice(0, 10),
    clockIn: toTimeStr(created.clockIn),
    clockOut: toTimeStr(created.clockOut),
    breakMinutes: created.breakMinutes,
    actualHours,
    status: "pending_approval",
    confirmStatus: created.confirmStatus,
    todoToday: null,
    doneToday: null,
    isModified: true,
  }, { status: 201 });
}
