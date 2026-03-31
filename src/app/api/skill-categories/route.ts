export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { createCategorySchema } from "@/backend/validations/skill";


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
    })),
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } }
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
