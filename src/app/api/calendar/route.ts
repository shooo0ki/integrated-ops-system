import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProjectStatus } from "@prisma/client";

const toHHMM = (dt: Date | null) => {
  if (!dt) return null;
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

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
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const memberIds = members.map((m) => m.id);

  // 勤務予定・勤怠・プロジェクトアサインを並行取得
  const [schedules, attendances, activeAssignments] = await Promise.all([
    prisma.workSchedule.findMany({
      where: { date: { gte: fromDate, lte: toDate }, memberId: { in: memberIds } },
      select: { memberId: true, date: true, startTime: true, endTime: true, isOff: true, locationType: true },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: fromDate, lte: toDate }, memberId: { in: memberIds } },
      select: { memberId: true, date: true, clockIn: true, clockOut: true, confirmStatus: true, locationType: true },
    }),
    prisma.projectAssignment.findMany({
      where: {
        memberId: { in: memberIds },
        project: {
          deletedAt: null,
          status: { in: [ProjectStatus.active, ProjectStatus.planning] },
        },
      },
      select: {
        memberId: true,
        project: { select: { id: true, name: true } },
      },
    }).catch(() => []), // プロジェクト取得失敗時は空配列にフォールバック
  ]);

  // プロジェクト一覧（重複除去）
  const projectMap = new Map<string, { id: string; name: string }>();
  const memberProjects: Record<string, string[]> = {};
  for (const a of activeAssignments) {
    if (!projectMap.has(a.project.id)) {
      projectMap.set(a.project.id, { id: a.project.id, name: a.project.name });
    }
    if (!memberProjects[a.memberId]) memberProjects[a.memberId] = [];
    if (!memberProjects[a.memberId].includes(a.project.id)) {
      memberProjects[a.memberId].push(a.project.id);
    }
  }

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      projectIds: memberProjects[m.id] ?? [],
    })),
    schedules: schedules.map((s) => ({
      memberId: s.memberId,
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      isOff: s.isOff,
      locationType: s.locationType,
    })),
    attendances: attendances.map((a) => ({
      memberId: a.memberId,
      date: a.date.toISOString().slice(0, 10),
      clockIn: toHHMM(a.clockIn),
      clockOut: toHHMM(a.clockOut),
      confirmStatus: a.confirmStatus,
      locationType: a.locationType,
    })),
    projects: Array.from(projectMap.values()),
  });
}
