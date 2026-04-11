export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { logger } from "@/backend/logger";
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

// GET /api/skills?month=YYYY-MM
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month は YYYY-MM 形式で必須です" } },
      { status: 400 }
    );
  }

  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  // 前月を算出
  const [y, m] = month.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1); // m-1 は当月(0-indexed)、m-2 は前月
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  try {
    if (isAdmin || isManager) {
      // personnelEvaluation テーブルを参照（評価サマリーと同一データソース）
      const [members, evaluations, prevEvaluations] = await Promise.all([
        prisma.member.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }],
        }),
        prisma.personnelEvaluation.findMany({
          where: { targetPeriod: month },
          select: {
            id: true, memberId: true, targetPeriod: true,
            scores: true, comment: true, updatedAt: true,
          },
        }),
        prisma.personnelEvaluation.findMany({
          where: { targetPeriod: prevMonth },
          select: { memberId: true, scores: true },
        }),
      ]);

      const evalMap = new Map(evaluations.map((a) => [a.memberId, a]));
      const prevMap = new Map(prevEvaluations.map((a) => [a.memberId, a.scores as EvalScores]));

      return NextResponse.json(
        members.map((m) => {
          const ev = evalMap.get(m.id);
          if (!ev) {
            return {
              memberId: m.id,
              memberName: m.name,
              evaluated: false,
              prevScores: prevMap.get(m.id) ?? null,
            };
          }
          const scores = (ev.scores ?? {}) as EvalScores;
          return {
            id: ev.id,
            memberId: m.id,
            memberName: m.name,
            targetPeriod: ev.targetPeriod,
            scores,
            axisAverages: buildAxisAverages(scores),
            totalAvg: calcTotalAverage(scores),
            comment: ev.comment,
            updatedAt: ev.updatedAt,
            evaluated: true,
          };
        })
      );
    }

    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "権限がありません" } },
      { status: 403 }
    );
  } catch (e) {
    logger.error("skills", "GET failed", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// POST /api/skills — 廃止（評価入力は /api/evaluations に統一）
export async function POST() {
  return NextResponse.json(
    { error: { code: "GONE", message: "このエンドポイントは廃止されました。/api/evaluations を使用してください。" } },
    { status: 410 }
  );
}
