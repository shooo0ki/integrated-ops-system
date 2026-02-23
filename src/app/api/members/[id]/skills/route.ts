import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createSkillEvalSchema } from "@/lib/validations/skill";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/members/:id/skills ──────────────────────────
// 全評価履歴を返す（descorder: 最新→古い）
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = await params;

  const records = await prisma.memberSkill.findMany({
    where: { memberId },
    include: {
      skill: {
        include: { category: { select: { id: true, name: true } } },
      },
      evaluator: {
        include: { member: { select: { name: true } } },
      },
    },
    orderBy: { evaluatedAt: "desc" },
  });

  return NextResponse.json(
    records.map((r) => ({
      id: r.id,
      skillId: r.skillId,
      skillName: r.skill.name,
      categoryId: r.skill.category.id,
      categoryName: r.skill.category.name,
      level: r.level,
      evaluatedAt: r.evaluatedAt,
      memo: r.memo,
      evaluatorName: r.evaluator.member.name,
    }))
  );
}

// ─── POST /api/members/:id/skills ─────────────────────────
// 追記型INSERT（UPDATE は行わない）
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id: memberId } = await params;

  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSkillEvalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const record = await prisma.memberSkill.create({
    data: {
      memberId,
      skillId: parsed.data.skillId,
      level: parsed.data.level,
      evaluatedAt: new Date(parsed.data.evaluatedAt),
      memo: parsed.data.memo,
      evaluatedBy: user.id,
    },
    include: {
      skill: { include: { category: { select: { id: true, name: true } } } },
      evaluator: { include: { member: { select: { name: true } } } },
    },
  });

  return NextResponse.json(
    {
      id: record.id,
      skillId: record.skillId,
      skillName: record.skill.name,
      categoryId: record.skill.category.id,
      categoryName: record.skill.category.name,
      level: record.level,
      evaluatedAt: record.evaluatedAt,
      memo: record.memo,
      evaluatorName: record.evaluator.member.name,
    },
    { status: 201 }
  );
}
