import { NextRequest, NextResponse } from "next/server";
import { type Company } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

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
    }))
  );
}

// POST /api/tools
// Body: { memberId, toolName, plan?, monthlyCost?, companyLabel, note? }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const { memberId, toolName, plan, monthlyCost, note } = body ?? {};

  if (!memberId || !toolName) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "memberId, toolName は必須です" } },
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

  const tool = await prisma.memberTool.create({
    data: {
      memberId,
      toolName,
      plan: plan || null,
      monthlyCost: monthlyCost ?? 0,
      companyLabel: "salt2",
      note: note || null,
    },
    include: { member: { select: { name: true } } },
  });

  return NextResponse.json(
    {
      id: tool.id,
      memberId: tool.memberId,
      memberName: tool.member.name,
      toolName: tool.toolName,
      plan: tool.plan,
      monthlyCost: tool.monthlyCost,
      companyLabel: tool.companyLabel,
      note: tool.note,
      updatedAt: tool.updatedAt,
    },
    { status: 201 }
  );
}
