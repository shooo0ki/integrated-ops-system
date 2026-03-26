import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { unauthorized, apiError } from "@/backend/api-response";
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

// GET /api/mypage-summary
// メンバー情報・スキル・プロジェクト・評価履歴を一括取得（マイページ用）
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const [member, assignments, evaluations, latestSkillAssessment] = await Promise.all([
    prisma.member.findFirst({
      where: { id: user.memberId, deletedAt: null },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        bankName: true,
        bankBranch: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
        status: true,
        salaryType: true,
        salaryAmount: true,
        joinedAt: true,
        userAccount: { select: { email: true, role: true } },
        skills: {
          select: {
            id: true,
            skillId: true,
            level: true,
            evaluatedAt: true,
            memo: true,
            skill: { select: { name: true, category: { select: { name: true } } } },
          },
          orderBy: { evaluatedAt: "desc" },
          distinct: ["skillId"],
        },
      },
    }),
    prisma.projectAssignment.findMany({
      where: {
        memberId: user.memberId,
        project: { deletedAt: null, status: { not: "completed" } },
      },
      select: {
        projectId: true,
        workloadHours: true,
        project: { select: { name: true } },
        position: { select: { positionName: true } },
      },
      take: 10,
    }),
    prisma.personnelEvaluation.findMany({
      where: { memberId: user.memberId },
      orderBy: { targetPeriod: "desc" },
      take: 6,
    }),
    prisma.skillAssessment.findFirst({
      where: { memberId: user.memberId },
      orderBy: { targetPeriod: "desc" },
      select: { targetPeriod: true, scores: true, updatedAt: true },
    }),
  ]);

  if (!member) return apiError("NOT_FOUND", "メンバーが見つかりません", 404);

  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name,
      phone: member.phone,
      address: member.address,
      bankName: member.bankName,
      bankBranch: member.bankBranch,
      bankAccountNumber: member.bankAccountNumber,
      bankAccountHolder: member.bankAccountHolder,
      status: member.status,
      salaryType: member.salaryType,
      salaryAmount: member.salaryAmount,
      joinedAt: member.joinedAt,
      email: member.userAccount?.email ?? "",
      role: member.userAccount?.role ?? "",
      skills: member.skills.map((s) => ({
        id: s.id,
        skillId: s.skillId,
        skillName: s.skill.name,
        categoryName: s.skill.category.name,
        level: s.level,
        evaluatedAt: s.evaluatedAt,
        memo: s.memo,
      })),
      projects: assignments.map((a) => ({
        projectId: a.projectId,
        projectName: a.project.name,
        role: a.position.positionName,
        workloadHours: a.workloadHours,
      })),
    },
    skillAssessment: latestSkillAssessment ? (() => {
      const scores = (latestSkillAssessment.scores ?? {}) as EvalScores;
      return {
        targetPeriod: latestSkillAssessment.targetPeriod,
        scores,
        axisAverages: buildAxisAverages(scores),
        totalAvg: calcTotalAverage(scores),
      };
    })() : null,
    evaluations: evaluations.map((ev) => {
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
  }, {
    headers: { "Cache-Control": "private, max-age=0, stale-while-revalidate=30" },
  });
}
