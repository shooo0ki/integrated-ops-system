import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

function scoreLabel(n: number) {
  return ["", "要改善", "普通以下", "標準", "優秀", "卓越"][n] ?? "—";
}

// GET /api/evaluations?month=YYYY-MM
// admin: 全員, その他: 自分のみ
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month は YYYY-MM 形式で必須です" } },
      { status: 400 }
    );
  }

  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  const evaluations = await prisma.personnelEvaluation.findMany({
    where: {
      targetPeriod: month,
      ...(isAdmin || isManager ? {} : { memberId: user.memberId }),
    },
    include: {
      member: { select: { id: true, name: true } },
      evaluator: { select: { id: true } },
    },
    orderBy: [{ member: { name: "asc" } }],
  });

  // 管理者向け：全メンバー一覧に評価を付加（未評価も含む）
  if (isAdmin || isManager) {
    const members = await prisma.member.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    });

    const evalMap = new Map(evaluations.map((e) => [e.memberId, e]));

    return NextResponse.json(
      members.map((m) => {
        const ev = evalMap.get(m.id);
        if (!ev) {
          return { memberId: m.id, memberName: m.name, evaluated: false };
        }
        const totalAvg = Math.round(((ev.scoreP + ev.scoreA + ev.scoreS) / 3) * 100) / 100;
        return {
          id: ev.id,
          memberId: m.id,
          memberName: m.name,
          targetPeriod: ev.targetPeriod,
          scoreP: ev.scoreP, labelP: scoreLabel(ev.scoreP),
          scoreA: ev.scoreA, labelA: scoreLabel(ev.scoreA),
          scoreS: ev.scoreS, labelS: scoreLabel(ev.scoreS),
          totalAvg,
          comment: ev.comment,
          updatedAt: ev.updatedAt,
          evaluated: true,
        };
      })
    );
  }

  // 自分のみ
  if (evaluations.length === 0) return NextResponse.json(null);
  const ev = evaluations[0];
  const totalAvg = Math.round(((ev.scoreP + ev.scoreA + ev.scoreS) / 3) * 100) / 100;
  return NextResponse.json({
    id: ev.id,
    memberId: ev.memberId,
    targetPeriod: ev.targetPeriod,
    scoreP: ev.scoreP, labelP: scoreLabel(ev.scoreP),
    scoreA: ev.scoreA, labelA: scoreLabel(ev.scoreA),
    scoreS: ev.scoreS, labelS: scoreLabel(ev.scoreS),
    totalAvg,
    comment: ev.comment,
    updatedAt: ev.updatedAt,
  });
}

// POST /api/evaluations — upsert (admin のみ)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const { memberId, targetPeriod, scoreP, scoreA, scoreS, comment } = body ?? {};

  if (!memberId || !targetPeriod || scoreP == null || scoreA == null || scoreS == null) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "memberId, targetPeriod, scoreP, scoreA, scoreS は必須です" } },
      { status: 400 }
    );
  }

  for (const [key, val] of [["scoreP", scoreP], ["scoreA", scoreA], ["scoreS", scoreS]]) {
    if (!Number.isInteger(val) || (val as number) < 1 || (val as number) > 5) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `${key} は 1〜5 の整数で入力してください` } },
        { status: 400 }
      );
    }
  }

  // 未来月チェック
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (targetPeriod > currentPeriod) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "未来の月は評価できません" } },
      { status: 400 }
    );
  }

  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
      { status: 404 }
    );
  }

  const existing = await prisma.personnelEvaluation.findUnique({
    where: { memberId_targetPeriod: { memberId, targetPeriod } },
  });

  let ev;
  if (existing) {
    ev = await prisma.personnelEvaluation.update({
      where: { id: existing.id },
      data: { scoreP, scoreA, scoreS, comment: comment ?? null, evaluatorId: user.id },
    });
  } else {
    ev = await prisma.personnelEvaluation.create({
      data: { memberId, evaluatorId: user.id, targetPeriod, scoreP, scoreA, scoreS, comment: comment ?? null },
    });
  }

  const totalAvg = Math.round(((ev.scoreP + ev.scoreA + ev.scoreS) / 3) * 100) / 100;
  return NextResponse.json(
    { id: ev.id, memberId: ev.memberId, targetPeriod: ev.targetPeriod, scoreP: ev.scoreP, scoreA: ev.scoreA, scoreS: ev.scoreS, totalAvg, comment: ev.comment, updatedAt: ev.updatedAt },
    { status: existing ? 200 : 201 }
  );
}
