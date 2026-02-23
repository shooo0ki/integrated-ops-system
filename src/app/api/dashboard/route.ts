import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const isAdmin = user.role === "admin" || user.role === "manager";

  // 1) 今日の自分の打刻
  const myAttendance = await prisma.attendance.findUnique({
    where: { memberId_date: { memberId: user.memberId, date: today } },
    select: { id: true, clockIn: true, clockOut: true, breakMinutes: true, workMinutes: true, todoToday: true },
  });

  const toHHMM = (dt: Date | null) => {
    if (!dt) return null;
    return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  // 2) 自分の担当プロジェクト（アサイン）
  const myAssignments = await prisma.projectAssignment.findMany({
    where: {
      memberId: user.memberId,
      project: { deletedAt: null, status: { not: "completed" } },
    },
    include: {
      project: { select: { id: true, name: true, company: true, status: true } },
      position: { select: { positionName: true } },
    },
    take: 5,
  });

  // 3) チーム在席状況（admin/manager のみ）
  let teamAttendance: Array<{
    memberId: string;
    memberName: string;
    status: string;
    clockIn: string | null;
    clockOut: string | null;
  }> = [];

  if (isAdmin) {
    // 今日の全メンバーの勤怠
    const todayAttendances = await prisma.attendance.findMany({
      where: { date: today },
      include: { member: { select: { id: true, name: true } } },
    });

    // 全アクティブメンバー
    const allMembers = await prisma.member.findMany({
      where: { deletedAt: null, leftAt: null },
      select: { id: true, name: true },
    });

    teamAttendance = allMembers.map((m) => {
      const att = todayAttendances.find((a) => a.memberId === m.id);
      let status = "not_started";
      if (att?.clockIn && att?.clockOut) status = "done";
      else if (att?.clockIn) status = "working";
      return {
        memberId: m.id,
        memberName: m.name,
        status,
        clockIn: att ? toHHMM(att.clockIn) : null,
        clockOut: att ? toHHMM(att.clockOut) : null,
      };
    });
  }

  // 4) PLサマリー（admin のみ）
  const currentMonth = todayStr.slice(0, 7);
  let plSummary: {
    totalRevenue: number;
    totalGrossProfit: number;
    boostRevenue: number;
    salt2Revenue: number;
    boostGrossProfit: number;
    salt2GrossProfit: number;
  } | null = null;

  if (user.role === "admin") {
    const plRecords = await prisma.pLRecord.findMany({
      where: { targetMonth: currentMonth, recordType: "pl" },
      include: { project: { select: { company: true } } },
    });

    const totalRevenue = plRecords.reduce((s, r) => s + r.revenueContract + r.revenueExtra, 0);
    const totalGrossProfit = plRecords.reduce((s, r) => s + r.grossProfit, 0);
    const boostPL = plRecords.filter((r) => r.project?.company === "boost");
    const salt2PL = plRecords.filter((r) => r.project?.company === "salt2");
    plSummary = {
      totalRevenue,
      totalGrossProfit,
      boostRevenue: boostPL.reduce((s, r) => s + r.revenueContract + r.revenueExtra, 0),
      salt2Revenue: salt2PL.reduce((s, r) => s + r.revenueContract + r.revenueExtra, 0),
      boostGrossProfit: boostPL.reduce((s, r) => s + r.grossProfit, 0),
      salt2GrossProfit: salt2PL.reduce((s, r) => s + r.grossProfit, 0),
    };
  }

  return NextResponse.json({
    today: todayStr,
    myAttendance: myAttendance
      ? {
          id: myAttendance.id,
          clockIn: toHHMM(myAttendance.clockIn),
          clockOut: toHHMM(myAttendance.clockOut),
          workMinutes: myAttendance.workMinutes,
          todoToday: myAttendance.todoToday,
          status: myAttendance.clockIn && myAttendance.clockOut
            ? "done"
            : myAttendance.clockIn
            ? "working"
            : "not_started",
        }
      : null,
    myProjects: myAssignments.map((a) => ({
      assignId: a.id,
      projectId: a.projectId,
      projectName: a.project.name,
      company: a.project.company,
      status: a.project.status,
      positionName: a.position.positionName,
      workloadHours: a.workloadHours,
    })),
    teamAttendance,
    plSummary,
    notStartedCount: isAdmin
      ? teamAttendance.filter((t) => t.status === "not_started").length
      : null,
  });
}
