export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSessionUser } from "@/backend/auth";
import { unauthorized, forbidden, apiError } from "@/backend/api-response";

type Params = { params: Promise<{ id: string; positionId: string }> };

// GET /api/projects/:id/positions/:positionId/required-skills
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { positionId } = await params;

  const skills = await prisma.positionRequiredSkill.findMany({
    where: { positionId },
    include: {
      skill: {
        select: { id: true, name: true, category: { select: { id: true, name: true } } },
      },
    },
    orderBy: { skill: { name: "asc" } },
  });

  return NextResponse.json(
    skills.map((s) => ({
      id: s.id,
      skillId: s.skillId,
      skillName: s.skill.name,
      categoryId: s.skill.category.id,
      categoryName: s.skill.category.name,
      minLevel: s.minLevel,
    }))
  );
}

// PUT /api/projects/:id/positions/:positionId/required-skills
// Body: { skills: [{ skillId, minLevel }] }
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { positionId } = await params;

  const position = await prisma.projectPosition.findUnique({ where: { id: positionId } });
  if (!position) return apiError("NOT_FOUND", "ポジションが見つかりません", 404);

  const body = await req.json().catch(() => null);
  const skills: { skillId: string; minLevel: number }[] = body?.skills ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.positionRequiredSkill.deleteMany({ where: { positionId } });
    if (skills.length > 0) {
      await tx.positionRequiredSkill.createMany({
        data: skills.map((s) => ({
          positionId,
          skillId: s.skillId,
          minLevel: Math.min(Math.max(s.minLevel, 1), 5),
        })),
      });
    }
  });

  const updated = await prisma.positionRequiredSkill.findMany({
    where: { positionId },
    include: {
      skill: {
        select: { id: true, name: true, category: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(
    updated.map((s) => ({
      id: s.id,
      skillId: s.skillId,
      skillName: s.skill.name,
      categoryId: s.skill.category.id,
      categoryName: s.skill.category.name,
      minLevel: s.minLevel,
    }))
  );
}
