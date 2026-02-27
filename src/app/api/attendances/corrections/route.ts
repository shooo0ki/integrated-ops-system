import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// GET /api/attendances/corrections
// admin/manager: 修正申請中（status='modified' かつ confirmStatus='unconfirmed'）の勤怠一覧
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const records = await prisma.attendance.findMany({
    where: {
      status: "modified",
      confirmStatus: "unconfirmed",
    },
    include: {
      member: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  function toTimeStr(dt: Date | null): string | null {
    if (!dt) return null;
    return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  }

  return NextResponse.json(
    records.map((r) => {
      const actualHours =
        r.workMinutes != null
          ? Math.round((r.workMinutes / 60) * 10) / 10
          : r.clockIn && r.clockOut
          ? Math.round(
              (Math.max(
                0,
                Math.round((r.clockOut.getTime() - r.clockIn.getTime()) / 60000) - r.breakMinutes
              ) /
                60) *
                10
            ) / 10
          : null;

      return {
        id: r.id,
        memberId: r.member.id,
        memberName: r.member.name,
        date: r.date.toISOString().slice(0, 10),
        clockIn: toTimeStr(r.clockIn),
        clockOut: toTimeStr(r.clockOut),
        breakMinutes: r.breakMinutes,
        actualHours,
        confirmStatus: r.confirmStatus,
      };
    })
  );
}
