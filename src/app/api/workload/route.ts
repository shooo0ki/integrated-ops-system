import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";


// ─── GET /api/workload?month=YYYY-MM ─────────────────────
// or  GET /api/workload?from=YYYY-MM&to=YYYY-MM (期間ビュー)
// メンバー × プロジェクトの工数マトリクスを返す
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const monthParam = searchParams.get("month");

  // 期間 or 単月
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let months: string[];
  if (fromParam && toParam) {
    months = generateMonths(fromParam, toParam);
  } else {
    const month = monthParam ?? currentMonth;
    months = [month];
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const periodStart = new Date(`${firstMonth}-01`);
  const lastDate = new Date(`${lastMonth}-01`);
  const periodEnd = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);

  // 削除されていないプロジェクト（active + planning + on_hold）
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: { in: ["active", "planning", "on_hold"] },
    },
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const projectIds = projects.map((p) => p.id);

  // アサイン（期間内に重なるもの）+ 月別稼働時間
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      projectId: { in: projectIds },
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
    },
    include: {
      member: { select: { id: true, name: true } },
      monthlyHours: {
        where: { targetMonth: { in: months } },
      },
    },
  });

  // メンバー一覧（重複排除）— 未アサイン枠はスキップ
  const memberMap = new Map<string, { id: string; name: string }>();
  for (const a of assignments) {
    if (!a.memberId || !a.member) continue;
    if (!memberMap.has(a.memberId)) memberMap.set(a.memberId, a.member);
  }
  const members = Array.from(memberMap.values());

  if (months.length === 1) {
    // 単月ビュー: 従来のマトリクス形式
    const month = months[0];
    const matrix: Record<string, Record<string, { assignId: string; hours: number }>> = {};
    for (const a of assignments) {
      if (!a.memberId) continue;
      if (!matrix[a.memberId]) matrix[a.memberId] = {};
      const mh = a.monthlyHours.find((m) => m.targetMonth === month);
      matrix[a.memberId][a.projectId] = {
        assignId: a.id,
        hours: mh ? mh.workloadHours : a.workloadHours,
      };
    }
    return NextResponse.json({ members, projects, matrix, months });
  }

  // 期間ビュー: memberId → projectId → month → hours
  const periodMatrix: Record<string, Record<string, Record<string, number>>> = {};
  for (const a of assignments) {
    if (!a.memberId) continue;
    if (!periodMatrix[a.memberId]) periodMatrix[a.memberId] = {};
    if (!periodMatrix[a.memberId][a.projectId]) periodMatrix[a.memberId][a.projectId] = {};

    const mhMap = new Map(a.monthlyHours.map((m) => [m.targetMonth, m.workloadHours]));
    for (const m of months) {
      const mDate = new Date(`${m}-01`);
      const mEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0);
      // この月にアサインが有効か
      if (a.startDate <= mEnd && (!a.endDate || a.endDate >= mDate)) {
        periodMatrix[a.memberId][a.projectId][m] = mhMap.get(m) ?? a.workloadHours;
      }
    }
  }

  return NextResponse.json({ members, projects, periodMatrix, months });
}

function generateMonths(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = [];
  let y = fy, m = fm;
  while ((y < ty || (y === ty && m <= tm)) && months.length < 24) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}
