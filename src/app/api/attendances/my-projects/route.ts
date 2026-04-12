export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";

// GET /api/attendances/my-projects — 自分にアサインされているPJ一覧
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const today = new Date();

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      memberId: user.memberId,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      project: { deletedAt: null, status: { in: ["active", "planning"] } },
    },
    select: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { project: { name: "asc" } },
  });

  // 重複除去（同PJに複数ポジションでアサインされている場合）
  const seen = new Set<string>();
  const projects = assignments
    .map((a) => a.project)
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

  return NextResponse.json(projects);
}
