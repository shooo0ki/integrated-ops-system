import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import {
  EVALUATION_AXES,
  ALL_ITEM_IDS,
  GRADES,
  calcAxisAverage,
  calcTotalAverage,
  type EvalScores,
  type ScoreGrade,
} from "@/shared/constants/evaluation-taxonomy";

function buildAxisAverages(scores: EvalScores) {
  const result: Record<string, number | null> = {};
  for (const axis of EVALUATION_AXES) {
    result[axis.key] = calcAxisAverage(scores, axis);
  }
  return result;
}

// GET /api/evaluations?month=YYYY-MM
// admin: 全員, その他: 自分のみ
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

  try {
    // 管理者向け：全メンバー一覧に評価を付加（未評価も含む）
    if (isAdmin || isManager) {
      const [members, evaluations] = await Promise.all([
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
      ]);

      const evalMap = new Map(evaluations.map((e) => [e.memberId, e]));

      return NextResponse.json(
        members.map((m) => {
          const ev = evalMap.get(m.id);
          if (!ev) {
            return { memberId: m.id, memberName: m.name, evaluated: false };
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

    // 自分のみ
    const evaluations = await prisma.personnelEvaluation.findMany({
      where: { targetPeriod: month, memberId: user.memberId },
      select: {
        id: true, memberId: true, targetPeriod: true,
        scores: true, comment: true, updatedAt: true,
      },
      take: 1,
    });

    if (evaluations.length === 0) return NextResponse.json(null);
    const ev = evaluations[0];
    const scores = (ev.scores ?? {}) as EvalScores;
    return NextResponse.json({
      id: ev.id,
      memberId: ev.memberId,
      targetPeriod: ev.targetPeriod,
      scores,
      axisAverages: buildAxisAverages(scores),
      totalAvg: calcTotalAverage(scores),
      comment: ev.comment,
      updatedAt: ev.updatedAt,
    });
  } catch (e) {
    console.error("[GET /api/evaluations]", e);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: String(e) } },
      { status: 500 }
    );
  }
}

// POST /api/evaluations — upsert (admin のみ)
export async function POST(req: NextRequest) {
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

  // バリデーション: scores の各キーが有効なitemId、値がA/B/C/D/null
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

  // 未来月チェック
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

  const existing = await prisma.personnelEvaluation.findUnique({
    where: { memberId_targetPeriod: { memberId, targetPeriod } },
  });

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1";
  const evalData = { scores: scores as EvalScores, comment: comment ?? null };

  const ev = await prisma.$transaction(async (tx) => {
    let record;
    if (existing) {
      record = await tx.personnelEvaluation.update({
        where: { id: existing.id },
        data: { ...evalData, evaluatorId: user.id },
      });
    } else {
      record = await tx.personnelEvaluation.create({
        data: { memberId, evaluatorId: user.id, targetPeriod, ...evalData },
      });
    }

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "personnel_evaluations",
        targetId: record.id,
        action: existing ? "UPDATE" : "CREATE",
        ...(existing ? { beforeData: JSON.parse(JSON.stringify(existing.scores)) } : {}),
        afterData: JSON.parse(JSON.stringify({ memberId, targetPeriod, ...evalData })),
        ipAddress: ip,
      },
    });

    return record;
  });

  const evScores = (ev.scores ?? {}) as EvalScores;
  return NextResponse.json(
    {
      id: ev.id,
      memberId: ev.memberId,
      targetPeriod: ev.targetPeriod,
      scores: evScores,
      axisAverages: buildAxisAverages(evScores),
      totalAvg: calcTotalAverage(evScores),
      comment: ev.comment,
      updatedAt: ev.updatedAt,
    },
    { status: existing ? 200 : 201 }
  );
}
