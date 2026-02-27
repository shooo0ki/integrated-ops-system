import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations/member";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/members/:id/profile
// メンバー本人またはadminが住所・口座情報を更新する
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  // 本人またはadminのみ許可
  const isSelf = user.memberId === id;
  const isAdmin = user.role === "admin";
  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "権限がありません" } },
      { status: 403 }
    );
  }

  const member = await prisma.member.findFirst({ where: { id, deletedAt: null } });
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
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

  const { phone, address, bankName, bankBranch, bankAccountNumber, bankAccountHolder } = parsed.data;

  const updated = await prisma.member.update({
    where: { id },
    data: {
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(bankName !== undefined && { bankName }),
      ...(bankBranch !== undefined && { bankBranch }),
      ...(bankAccountNumber !== undefined && { bankAccountNumber }),
      ...(bankAccountHolder !== undefined && { bankAccountHolder }),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      bankName: true,
      bankBranch: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
    },
  });

  return NextResponse.json(updated);
}
