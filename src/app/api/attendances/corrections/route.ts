export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";


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
    const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
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
