import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { updateCategorySchema } from "@/lib/validations/skill";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

// ─── PUT /api/skill-categories/:id ───────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  if (parsed.data.name) {
    const conflict = await prisma.skillCategory.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "同名のカテゴリがすでに存在します" } },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.skillCategory.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ id: updated.id, name: updated.name });
}

// ─── DELETE /api/skill-categories/:id ────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id } = await params;

  // 評価データ → スキル → カテゴリの順に削除
  await prisma.$transaction([
    prisma.memberSkill.deleteMany({ where: { skill: { categoryId: id } } }),
    prisma.skill.deleteMany({ where: { categoryId: id } }),
    prisma.skillCategory.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
