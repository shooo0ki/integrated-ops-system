import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
  newPassword: z.string().min(8, "新しいパスワードは8文字以上で入力してください"),
});

type Params = { params: Promise<{ id: string }> };

// POST /api/members/:id/profile/password
// 本人のみ: パスワード変更
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  // パスワード変更は本人のみ
  if (user.memberId !== id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "自分のパスワードのみ変更できます" } },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "入力値が不正です",
        },
      },
      { status: 400 }
    );
  }

  const account = await prisma.userAccount.findUnique({
    where: { memberId: id },
    select: { id: true, passwordHash: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "アカウントが見つかりません" } },
      { status: 404 }
    );
  }

  // 現在のパスワードが空文字（契約フローで作成されたアカウント）の場合はスキップ
  if (account.passwordHash !== "") {
    const valid = await compare(parsed.data.currentPassword, account.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: { code: "INVALID_PASSWORD", message: "現在のパスワードが正しくありません" } },
        { status: 400 }
      );
    }
  }

  const newHash = await hash(parsed.data.newPassword, 12);
  await prisma.userAccount.update({
    where: { id: account.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}
