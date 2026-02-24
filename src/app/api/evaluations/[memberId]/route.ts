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

// GET /api/evaluations/:memberId?limit=12
// admin/manager: 誰でも閲覧可。その他: 自分のみ
export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { memberId } = params;
  const isAdmin = user.role === "admin";
  const isManager = user.role === "manager";

  // 自分以外を参照しようとした場合は403
  if (!isAdmin && !isManager && user.memberId !== memberId) {
    return forbidden();
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12", 10), 36);

  const evaluations = await prisma.personnelEvaluation.findMany({
    where: { memberId },
    orderBy: { targetPeriod: "desc" },
    take: limit,
  });

  return NextResponse.json(
    evaluations.map((ev) => {
      const totalAvg = Math.round(((ev.scoreP + ev.scoreA + ev.scoreS) / 3) * 100) / 100;
      return {
        id: ev.id,
        memberId: ev.memberId,
        targetPeriod: ev.targetPeriod,
        scoreP: ev.scoreP, labelP: scoreLabel(ev.scoreP),
        scoreA: ev.scoreA, labelA: scoreLabel(ev.scoreA),
        scoreS: ev.scoreS, labelS: scoreLabel(ev.scoreS),
        totalAvg,
        comment: ev.comment,
        updatedAt: ev.updatedAt,
      };
    })
  );
}
