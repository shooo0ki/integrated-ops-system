export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { unauthorized, apiError } from "@/backend/api-response";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // メンバー詳細とプロジェクトアサインを並列取得
  const [member, assignments] = await Promise.all([
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
  ]);

  if (!member) return apiError("NOT_FOUND", "メンバーが見つかりません", 404);

  return NextResponse.json({
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
  }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } });
}
