import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { updateMemberSchema } from "@/lib/validations/member";

function unauthorized() {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
    { status: 401 }
  );
}
function forbidden() {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "権限がありません" } },
    { status: 403 }
  );
}
function notFound() {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
    { status: 404 }
  );
}

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/members/:id ─────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: {
      userAccount: { select: { email: true, role: true } },
      tools: { orderBy: { createdAt: "asc" } },
      skills: {
        include: {
          skill: { include: { category: { select: { name: true } } } },
        },
        orderBy: { evaluatedAt: "desc" },
      },
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!member) return notFound();

  // skillId ごとに最新1件のみ
  const latestSkillMap: Record<string, typeof member.skills[0]> = {};
  for (const s of member.skills) {
    if (!latestSkillMap[s.skillId]) latestSkillMap[s.skillId] = s;
  }
  const latestSkills = Object.values(latestSkillMap);

  // 住所・口座は本人またはadminのみ返す
  const isSelf = user.memberId === id;
  const isAdmin = user.role === "admin";

  return NextResponse.json({
    id: member.id,
    name: member.name,
    phone: member.phone,
    address: (isSelf || isAdmin) ? member.address : undefined,
    bankName: (isSelf || isAdmin) ? member.bankName : undefined,
    bankBranch: (isSelf || isAdmin) ? member.bankBranch : undefined,
    bankAccountNumber: (isSelf || isAdmin) ? member.bankAccountNumber : undefined,
    bankAccountHolder: (isSelf || isAdmin) ? member.bankAccountHolder : undefined,
    status: member.status,
    salaryType: member.salaryType,
    salaryAmount: member.salaryAmount,
    joinedAt: member.joinedAt,
    deletedAt: member.deletedAt,
    createdAt: member.createdAt,
    email: member.userAccount?.email ?? "",
    role: member.userAccount?.role ?? "",
    tools: member.tools.map((t) => ({
      id: t.id,
      toolName: t.toolName,
      plan: t.plan,
      monthlyCost: t.monthlyCost,
      companyLabel: t.companyLabel,
      note: t.note,
    })),
    skills: latestSkills.map((s) => ({
      id: s.id,
      skillId: s.skillId,
      skillName: s.skill.name,
      categoryName: s.skill.category.name,
      level: s.level,
      evaluatedAt: s.evaluatedAt,
      memo: s.memo,
    })),
    contracts: member.contracts.map((c) => ({
      id: c.id,
      status: c.status,
      templateName: c.templateName,
      startDate: c.startDate,
      endDate: c.endDate,
    })),
  });
}

// ─── PUT /api/members/:id ─────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id } = await params;

  const member = await prisma.member.findFirst({ where: { id, deletedAt: null } });
  if (!member) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "入力値が不正です",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { role, ...memberData } = parsed.data;
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1";

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.member.update({
      where: { id },
      data: {
        ...(memberData.name !== undefined && { name: memberData.name }),
        ...(memberData.phone !== undefined && { phone: memberData.phone }),
        ...(memberData.address !== undefined && { address: memberData.address }),
        ...(memberData.bankName !== undefined && { bankName: memberData.bankName }),
        ...(memberData.bankBranch !== undefined && { bankBranch: memberData.bankBranch }),
        ...(memberData.bankAccountNumber !== undefined && { bankAccountNumber: memberData.bankAccountNumber }),
        ...(memberData.bankAccountHolder !== undefined && { bankAccountHolder: memberData.bankAccountHolder }),
        ...(memberData.status !== undefined && { status: memberData.status }),
        ...(memberData.salaryType !== undefined && { salaryType: memberData.salaryType }),
        ...(memberData.salaryAmount !== undefined && { salaryAmount: memberData.salaryAmount }),
      },
    });

    if (role !== undefined) {
      await tx.userAccount.update({ where: { memberId: id }, data: { role } });
    }

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "members",
        targetId: id,
        action: "UPDATE",
        beforeData: { name: member.name, status: member.status },
        afterData: parsed.data as object,
        ipAddress: ip,
      },
    });

    return m;
  });

  return NextResponse.json({ id: updated.id, name: updated.name });
}

// ─── DELETE /api/members/:id ──────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id } = await params;

  const member = await prisma.member.findFirst({ where: { id, deletedAt: null } });
  if (!member) return notFound();

  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1";

  await prisma.$transaction(async (tx) => {
    await tx.member.update({ where: { id }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "members",
        targetId: id,
        action: "DELETE",
        beforeData: { name: member.name },
        ipAddress: ip,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
