import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// ─── GET /api/attendances?memberId=&month=YYYY-MM ─────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId") ?? user.memberId;
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

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

  function toTimeStr(dt: Date | null): string | null {
    if (!dt) return null;
    return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  }

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
      if (r.status === "absent") {
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
    })
  );
}
