export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { type Company } from "@prisma/client";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";


// GET /api/tools?company=&memberId=&toolName=
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const url = new URL(req.url);
  const company = url.searchParams.get("company");
  const memberId = url.searchParams.get("memberId");
  const toolName = url.searchParams.get("toolName");

  const tools = await prisma.memberTool.findMany({
    where: {
      ...(company ? { companyLabel: company as Company } : {}),
      ...(memberId ? { memberId } : {}),
      ...(toolName ? { toolName } : {}),
      member: { deletedAt: null },
    },
    include: { member: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    tools.map((t) => ({
      id: t.id,
      memberId: t.memberId,
      memberName: t.member.name,
      toolName: t.toolName,
      plan: t.plan,
      monthlyCost: t.monthlyCost,
      companyLabel: t.companyLabel,
      note: t.note,
      updatedAt: t.updatedAt,
    })),

  );
}

// POST /api/tools
// Body: { memberId, toolName, plan?, monthlyCost?, note? }
//   or: { memberIds: string[], toolName, plan?, monthlyCost?, note? }  (一括追加)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const { memberId, memberIds, toolName, plan, monthlyCost, note } = body ?? {};

  // memberIds (配列) or memberId (単体) を統一
  const ids: string[] = Array.isArray(memberIds) && memberIds.length > 0
    ? memberIds
    : memberId ? [memberId] : [];

  if (ids.length === 0 || !toolName) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "memberId(s), toolName は必須です" } },
      { status: 400 }
    );
  }

  // メンバー存在チェック
  const validMembers = await prisma.member.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(validMembers.map((m) => m.id));
  const targetIds = ids.filter((id) => validIds.has(id));

  if (targetIds.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "有効なメンバーが見つかりません" } },
      { status: 404 }
    );
  }

  // 一括作成
  const created = await prisma.$transaction(
    targetIds.map((mid) =>
      prisma.memberTool.create({
        data: {
          memberId: mid,
          toolName,
          plan: plan || null,
          monthlyCost: monthlyCost ?? 0,
          companyLabel: "salt2",
          note: note || null,
        },
        include: { member: { select: { name: true } } },
      })
    )
  );

  const result = created.map((tool) => ({
    id: tool.id,
    memberId: tool.memberId,
    memberName: tool.member.name,
    toolName: tool.toolName,
    plan: tool.plan,
    monthlyCost: tool.monthlyCost,
    companyLabel: tool.companyLabel,
    note: tool.note,
    updatedAt: tool.updatedAt,
  }));

  return NextResponse.json(result.length === 1 ? result[0] : result, { status: 201 });
}
