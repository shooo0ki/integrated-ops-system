import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSessionUser } from "@/backend/auth";

// ─── GET /api/skill-matrix ────────────────────────────────
// query: company (boost|salt2), categoryId, minLevel (1-5)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const categoryId = searchParams.get("categoryId") ?? "";
  const minLevel = Number(searchParams.get("minLevel") ?? "0");

  // カテゴリとメンバーを並列取得
  const [categories, members] = await Promise.all([
    prisma.skillCategory.findMany({
      where: categoryId ? { id: categoryId } : undefined,
      include: { skills: { orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.member.findMany({
      where: { deletedAt: null },
      include: { userAccount: { select: { role: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const skillIds = categories.flatMap((c) => c.skills.map((s) => s.id));

  // 評価履歴から memberId+skillId ごとの最新1件だけ取得
  const memberIds = members.map((m) => m.id);
  const latestSkills =
    skillIds.length > 0 && memberIds.length > 0
      ? await prisma.memberSkill.findMany({
          where: {
            memberId: { in: memberIds },
            skillId: { in: skillIds },
          },
          orderBy: [
            { memberId: "asc" },
            { skillId: "asc" },
            { evaluatedAt: "desc" },
          ],
          distinct: ["memberId", "skillId"],
          select: {
            memberId: true,
            skillId: true,
            level: true,
          },
        })
      : [];

  const levelMap: Record<string, Record<string, number>> = {};
  for (const m of members) {
    levelMap[m.id] = {};
  }
  for (const sk of latestSkills) {
    levelMap[sk.memberId][sk.skillId] = sk.level;
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
      role: m.userAccount?.role ?? "",
    })),
    levelMap,
  }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
}
