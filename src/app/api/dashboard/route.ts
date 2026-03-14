import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // JST 基準の「今日」0時を計算
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
  const todayStr = today.toISOString().slice(0, 10);
  const isAdmin = user.role === "admin" || user.role === "manager";
  const { searchParams } = new URL(req.url);
  const isLite = searchParams.get("lite") === "1" || (!isAdmin && searchParams.get("lite") !== "0");

  const toHHMM = (dt: Date | null) => {
    if (!dt) return null;
    const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
  };

  // 1) 今日の自分の打刻 + 2) 自分の担当プロジェクト（並列取得）
  const [myAttendance, myAssignments] = await Promise.all([
    prisma.attendance.findUnique({
      where: { memberId_date: { memberId: user.memberId, date: today } },
      select: { id: true, clockIn: true, clockOut: true, breakMinutes: true, workMinutes: true, todoToday: true },
    }),
    prisma.projectAssignment.findMany({
      where: {
        memberId: user.memberId,
        project: { deletedAt: null, status: { not: "completed" } },
      },
      select: {
        id: true,
        projectId: true,
        workloadHours: true,
        project: { select: { id: true, name: true, company: true, status: true } },
        position: { select: { positionName: true } },
      },
      take: 5,
    }),
  ]);

  // 3) チーム在席 + PLサマリー：admin/manager かつ非Lite のみ（並列取得）
  let teamAttendance: Array<{
    memberId: string;
    memberName: string;
    status: string;
    clockIn: string | null;
    clockOut: string | null;
  }> = [];
  const currentMonth = todayStr.slice(0, 7);
  let plSummary: {
    totalRevenue: number;
    totalGrossProfit: number;
    boostRevenue: number;
    salt2Revenue: number;
    boostGrossProfit: number;
    salt2GrossProfit: number;
  } | null = null;

  if (isAdmin && !isLite) {
    // PLサマリーは aggregate 3本で DB 側集計（全行転送→JS reduce を排除）
    const [todayAttendances, allMembers, totalAgg, boostAgg, salt2Agg] = await Promise.all([
      // 今日の全メンバーの打刻（必要フィールドのみ）
      prisma.attendance.findMany({
        where: { date: today },
        select: { memberId: true, clockIn: true, clockOut: true },
      }),
      // 全アクティブメンバー
      prisma.member.findMany({
        where: { deletedAt: null, leftAt: null },
        select: { id: true, name: true },
      }),
      // PL 合計 / boost / salt2 を並列 aggregate
      user.role === "admin"
        ? prisma.pLRecord.aggregate({
            where: { targetMonth: currentMonth, recordType: "pl" },
            _sum: { revenueContract: true, revenueExtra: true, grossProfit: true },
          })
        : Promise.resolve(null),
      user.role === "admin"
        ? prisma.pLRecord.aggregate({
            where: { targetMonth: currentMonth, recordType: "pl", project: { company: "boost" } },
            _sum: { revenueContract: true, revenueExtra: true, grossProfit: true },
          })
        : Promise.resolve(null),
      user.role === "admin"
        ? prisma.pLRecord.aggregate({
            where: { targetMonth: currentMonth, recordType: "pl", project: { company: "salt2" } },
            _sum: { revenueContract: true, revenueExtra: true, grossProfit: true },
          })
        : Promise.resolve(null),
    ]);

    const attendanceByMember = new Map(
      todayAttendances.map((a) => [a.memberId, a])
    );

    teamAttendance = allMembers.map((m) => {
      const att = attendanceByMember.get(m.id);
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

    if (user.role === "admin" && totalAgg) {
      const totalRevenue = (totalAgg._sum.revenueContract ?? 0) + (totalAgg._sum.revenueExtra ?? 0);
      if (totalRevenue > 0 || (totalAgg._sum.grossProfit ?? 0) > 0) {
        plSummary = {
          totalRevenue,
          totalGrossProfit: totalAgg._sum.grossProfit ?? 0,
          boostRevenue: (boostAgg!._sum.revenueContract ?? 0) + (boostAgg!._sum.revenueExtra ?? 0),
          salt2Revenue: (salt2Agg!._sum.revenueContract ?? 0) + (salt2Agg!._sum.revenueExtra ?? 0),
          boostGrossProfit: boostAgg!._sum.grossProfit ?? 0,
          salt2GrossProfit: salt2Agg!._sum.grossProfit ?? 0,
        };
      }
    }
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
    notStartedCount: isAdmin && !isLite
      ? teamAttendance.filter((t) => t.status === "not_started").length
      : null,
  });
}
