import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createMemberSchema } from "@/lib/validations/member";

// ─── 共通レスポンスヘルパー ────────────────────────────────
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

// ─── GET /api/members ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const company = searchParams.get("company") ?? "";
  const role = searchParams.get("role") ?? "";

  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      ...(company ? { company } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { userAccount: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(role ? { userAccount: { role } } : {}),
    },
    include: {
      userAccount: { select: { email: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      company: m.company,
      salaryType: m.salaryType,
      salaryAmount: m.salaryAmount,
      joinedAt: m.joinedAt,
      email: m.userAccount?.email ?? "",
      role: m.userAccount?.role ?? "",
      createdAt: m.createdAt,
    }))
  );
}

// ─── POST /api/members ────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(body);
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

  const data = parsed.data;

  // メール重複チェック
  const existing = await prisma.userAccount.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "このメールアドレスは既に使用されています" } },
      { status: 409 }
    );
  }

  const passwordHash = await hash(data.password, 12);
  const ip =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1";

  const newMember = await prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        name: data.name,
        phone: data.phone,
        status: data.status,
        company: data.company,
        salaryType: data.salaryType,
        salaryAmount: data.salaryAmount,
        joinedAt: new Date(data.joinedAt),
      },
    });

    await tx.userAccount.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        memberId: member.id,
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "members",
        targetId: member.id,
        action: "CREATE",
        afterData: { name: data.name, email: data.email, role: data.role },
        ipAddress: ip,
      },
    });

    return member;
  });

  return NextResponse.json(
    { id: newMember.id, name: newMember.name, email: data.email },
    { status: 201 }
  );
}
