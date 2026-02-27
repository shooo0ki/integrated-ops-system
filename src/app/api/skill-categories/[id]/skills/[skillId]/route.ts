import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { updateSkillSchema } from "@/lib/validations/skill";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string; skillId: string }> };

// ─── PUT /api/skill-categories/:id/skills/:skillId ────────
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id: categoryId, skillId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  if (parsed.data.name) {
    const conflict = await prisma.skill.findFirst({
      where: { categoryId, name: parsed.data.name, NOT: { id: skillId } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "同名のスキルがすでに存在します" } },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.skill.update({
    where: { id: skillId },
    data: parsed.data,
  });

  return NextResponse.json({ id: updated.id, name: updated.name });
}

// ─── DELETE /api/skill-categories/:id/skills/:skillId ─────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { skillId } = await params;

  // 評価データを先に削除してからスキルを削除
  await prisma.$transaction([
    prisma.memberSkill.deleteMany({ where: { skillId } }),
    prisma.skill.delete({ where: { id: skillId } }),
  ]);

  return NextResponse.json({ ok: true });
}
