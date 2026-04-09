export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSessionUser } from "@/backend/auth";
import { updateProfileSchema } from "@/backend/validations/member";
import { sendEmail } from "@/backend/email";
import { encryptBankFields, decryptBankFields } from "@/backend/crypto";

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

  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: { userAccount: true },
  });
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

  const { email, phone, address, bankName, bankBranch, bankAccountNumber, bankAccountHolder } = parsed.data;

  const emailChanged = email !== undefined && email !== member.userAccount?.email;

  const [updatedMember, updatedUser] = await prisma.$transaction([
    prisma.member.update({
      where: { id },
      data: {
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...encryptBankFields({
          ...(bankName !== undefined && { bankName }),
          ...(bankBranch !== undefined && { bankBranch }),
          ...(bankAccountNumber !== undefined && { bankAccountNumber }),
          ...(bankAccountHolder !== undefined && { bankAccountHolder }),
        }),
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
    }),
    emailChanged
      ? prisma.userAccount.update({
          where: { memberId: id },
          data: { email: email! },
          select: { email: true },
        })
      : prisma.userAccount.findUnique({
          where: { memberId: id },
          select: { email: true },
        }),
  ]);

  // メール変更時の通知（SMTP未設定ならスキップ）
  if (emailChanged && updatedUser?.email) {
    await sendEmail({
      to: updatedUser.email,
      subject: "【SALT2 OPS】メールアドレスを更新しました",
      text: [
        `${updatedMember.name} さん`,
        "",
        "SALT2 OPS でアカウントのメールアドレスが更新されました。",
        `新しいメールアドレス: ${updatedUser.email}`,
        "",
        "もし心当たりがない場合は管理者までご連絡ください。",
      ].join("\n"),
    }).catch(() => { /* 送信失敗は握りつぶす（ログ不要） */ });
  }

  return NextResponse.json({
    ...decryptBankFields(updatedMember),
    email: updatedUser?.email ?? member.userAccount?.email ?? null,
  });
}
