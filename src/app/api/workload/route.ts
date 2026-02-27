import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}

// ─── GET /api/workload?month=YYYY-MM ─────────────────────
// メンバー × プロジェクトの工数マトリクスを返す
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  // アクティブなプロジェクト
  const projects = await prisma.project.findMany({
    where: { status: "active", deletedAt: null },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  const projectIds = projects.map((p) => p.id);

  // そのプロジェクトに紐づくアサイン（月フィルタは startDate/endDate ベース）
  const monthStart = new Date(`${month}-01`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      projectId: { in: projectIds },
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
    include: {
      member: { select: { id: true, name: true } },
    },
  });

  // メンバー一覧（重複排除）
  const memberMap = new Map<string, { id: string; name: string }>();
  for (const a of assignments) {
    if (!memberMap.has(a.memberId)) memberMap.set(a.memberId, a.member);
  }
  const members = Array.from(memberMap.values());

  // マトリクス: memberId → projectId → { assignId, hours }
  const matrix: Record<string, Record<string, { assignId: string; hours: number }>> = {};
  for (const a of assignments) {
    if (!matrix[a.memberId]) matrix[a.memberId] = {};
    matrix[a.memberId][a.projectId] = { assignId: a.id, hours: a.workloadHours };
  }

  return NextResponse.json({ members, projects, matrix });
}
