import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createCategorySchema } from "@/lib/validations/skill";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// ─── GET /api/skill-categories ────────────────────────────
export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const categories = await prisma.skillCategory.findMany({
    include: {
      skills: { orderBy: { displayOrder: "asc" } },
    },
    orderBy: { displayOrder: "asc" },
  });

  return NextResponse.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.displayOrder,
      skills: c.skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        displayOrder: s.displayOrder,
      })),
    }))
  );
}

// ─── POST /api/skill-categories ───────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const existing = await prisma.skillCategory.findFirst({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "同名のカテゴリがすでに存在します" } },
      { status: 409 }
    );
  }

  const category = await prisma.skillCategory.create({
    data: {
      name: parsed.data.name,
      displayOrder: parsed.data.displayOrder ?? 99,
    },
    include: { skills: true },
  });

  return NextResponse.json(
    { id: category.id, name: category.name, displayOrder: category.displayOrder, skills: [] },
    { status: 201 }
  );
}
