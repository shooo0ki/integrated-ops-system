export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import {
  EVALUATION_AXES,
  calcAxisAverage,
  calcTotalAverage,
  type EvalScores,
} from "@/shared/constants/evaluation-taxonomy";

function buildAxisAverages(scores: EvalScores) {
  const result: Record<string, number | null> = {};
  for (const axis of EVALUATION_AXES) {
    result[axis.key] = calcAxisAverage(scores, axis);
  }
  return result;
}

// GET /api/evaluations/:memberId?limit=12
// admin/manager: 誰でも閲覧可。その他: 自分のみ
export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { memberId } = params;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  if (!isAdmin && !isManager && user.memberId !== memberId) {
    return forbidden();
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12", 10), 36);

  const evaluations = await prisma.personnelEvaluation.findMany({
    where: { memberId },
    orderBy: { targetPeriod: "desc" },
    take: limit,
  });

  return NextResponse.json(
    evaluations.map((ev) => {
      const scores = (ev.scores ?? {}) as EvalScores;
      return {
        id: ev.id,
        memberId: ev.memberId,
        targetPeriod: ev.targetPeriod,
        scores,
        axisAverages: buildAxisAverages(scores),
        totalAvg: calcTotalAverage(scores),
        comment: ev.comment,
        updatedAt: ev.updatedAt,
      };
    }),
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
  );
}
