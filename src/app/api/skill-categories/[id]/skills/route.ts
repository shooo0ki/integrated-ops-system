export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { createSkillSchema } from "@/backend/validations/skill";


type Params = { params: Promise<{ id: string }> };

// ─── POST /api/skill-categories/:id/skills ────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id: categoryId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = createSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const conflict = await prisma.skill.findFirst({
    where: { categoryId, name: parsed.data.name },
  });
  if (conflict) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "同名のスキルがすでに存在します" } },
      { status: 409 }
    );
  }

  const skill = await prisma.skill.create({
    data: {
      categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      displayOrder: parsed.data.displayOrder ?? 99,
    },
  });

  return NextResponse.json(
    { id: skill.id, name: skill.name, description: skill.description, displayOrder: skill.displayOrder },
    { status: 201 }
  );
}
