import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// ─── GET /api/skill-matrix ────────────────────────────────
// query: company (boost|salt2), categoryId, minLevel (1-5)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const company = searchParams.get("company") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const minLevel = Number(searchParams.get("minLevel") ?? "0");

  // カテゴリ（フィルタ対応）
  const categories = await prisma.skillCategory.findMany({
    where: categoryId ? { id: categoryId } : undefined,
    include: { skills: { orderBy: { displayOrder: "asc" } } },
    orderBy: { displayOrder: "asc" },
  });

  const skillIds = categories.flatMap((c) => c.skills.map((s) => s.id));

  // メンバーとスキル評価（最新1件/skillId）
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      ...(company ? { company } : {}),
    },
    include: {
      skills: {
        where: { skillId: { in: skillIds } },
        orderBy: { evaluatedAt: "desc" },
      },
      userAccount: { select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // skillId ごとに最新レベルだけ残す
  const levelMap: Record<string, Record<string, number>> = {};
  for (const m of members) {
    levelMap[m.id] = {};
    for (const sk of m.skills) {
      if (!(sk.skillId in levelMap[m.id])) {
        levelMap[m.id][sk.skillId] = sk.level;
      }
    }
  }

  // minLevel フィルタ: 対象カテゴリのスキルで minLevel 以上が1つでもあるメンバー
  const filteredMembers = minLevel > 0
    ? members.filter((m) =>
        skillIds.some((sid) => (levelMap[m.id]?.[sid] ?? 0) >= minLevel)
      )
    : members;

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      skills: c.skills.map((s) => ({ id: s.id, name: s.name })),
    })),
    members: filteredMembers.map((m) => ({
      id: m.id,
      name: m.name,
      company: m.company,
      role: m.userAccount?.role ?? "",
    })),
    levelMap,
  });
}
