import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const toHHMM = (dt: Date | null) => {
  if (!dt) return null;
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");     // YYYY-MM-DD

  if (!from || !to) {
    return NextResponse.json({ error: "from と to は必須です" }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  // アクティブなメンバー一覧
  const members = await prisma.member.findMany({
    where: { deletedAt: null, leftAt: null },
    select: { id: true, name: true, company: true },
    orderBy: { name: "asc" },
  });

  // 勤務予定
  const schedules = await prisma.workSchedule.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      memberId: { in: members.map((m) => m.id) },
    },
    select: { memberId: true, date: true, startTime: true, endTime: true, isOff: true },
  });

  // 勤怠実績
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      memberId: { in: members.map((m) => m.id) },
    },
    select: { memberId: true, date: true, clockIn: true, clockOut: true, confirmStatus: true },
  });

  return NextResponse.json({
    members,
    schedules: schedules.map((s) => ({
      memberId: s.memberId,
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      isOff: s.isOff,
    })),
    attendances: attendances.map((a) => ({
      memberId: a.memberId,
      date: a.date.toISOString().slice(0, 10),
      clockIn: toHHMM(a.clockIn),
      clockOut: toHHMM(a.clockOut),
      confirmStatus: a.confirmStatus,
    })),
  });
}
