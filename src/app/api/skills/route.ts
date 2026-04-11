export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { logger } from "@/backend/logger";
import {
  EVALUATION_AXES,
  ALL_ITEM_IDS,
  GRADES,
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

// POST /api/skills — 廃止（評価入力は /api/evaluations に統一。マージ後に削除予定）
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: { code: "GONE", message: "このエンドポイントは廃止されました。/api/evaluations を使用してください。" } },
    { status: 410 }
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _legacyPost(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const { memberId, targetPeriod, scores, comment } = body ?? {};

  if (!memberId || !targetPeriod || !scores || typeof scores !== "object") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "memberId, targetPeriod, scores は必須です" } },
      { status: 400 }
    );
  }

  const validGrades = new Set<string | null>([...GRADES, null]);
  for (const [key, val] of Object.entries(scores as Record<string, unknown>)) {
    if (!ALL_ITEM_IDS.includes(key)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `不正な評価項目ID: ${key}` } },
        { status: 400 }
      );
    }
    if (val !== null && !validGrades.has(val as string)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `${key} の値は A/B/C/D/null のいずれかです` } },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (targetPeriod > currentPeriod) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "未来の月は評価できません" } },
      { status: 400 }
    );
  }

  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
      { status: 404 }
    );
  }

  const existing = await prisma.skillAssessment.findUnique({
    where: { memberId_targetPeriod: { memberId, targetPeriod } },
  });

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1";
  const saData = { scores: scores as EvalScores, comment: comment ?? null };

  const sa = await prisma.$transaction(async (tx) => {
    let record;
    if (existing) {
      record = await tx.skillAssessment.update({
        where: { id: existing.id },
        data: { ...saData, evaluatorId: user.id },
      });
    } else {
      record = await tx.skillAssessment.create({
        data: { memberId, evaluatorId: user.id, targetPeriod, ...saData },
      });
    }

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "skill_assessments",
        targetId: record.id,
        action: existing ? "UPDATE" : "CREATE",
        ...(existing ? { beforeData: JSON.parse(JSON.stringify(existing.scores)) } : {}),
        afterData: JSON.parse(JSON.stringify({ memberId, targetPeriod, ...saData })),
        ipAddress: ip,
      },
    });

    return record;
  });

  const saScores = (sa.scores ?? {}) as EvalScores;
  return NextResponse.json(
    {
      id: sa.id,
      memberId: sa.memberId,
      targetPeriod: sa.targetPeriod,
      scores: saScores,
      axisAverages: buildAxisAverages(saScores),
      totalAvg: calcTotalAverage(saScores),
      comment: sa.comment,
      updatedAt: sa.updatedAt,
    },
    { status: existing ? 200 : 201 }
  );
}
