import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, type AppRole } from "@/lib/auth";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const account = await prisma.userAccount.findUnique({
    where: { email },
    include: {
      member: { select: { id: true, name: true } },
    },
  });

  if (!account) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません。" },
      { status: 401 }
    );
  }

  const valid = await compare(password, account.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません。" },
      { status: 401 }
    );
  }

  // DBのUserRole（employee / intern_full / intern_training / training_member）を
  // アプリ層の3段階ロールに正規化する
  const normalizedRole: AppRole =
    account.role === "admin"
      ? "admin"
      : account.role === "manager"
      ? "manager"
      : "member";

  const session = await getSession();
  session.user = {
    id: account.id,
    memberId: account.member.id,
    email: account.email,
    role: normalizedRole,
    name: account.member.name,
  };
  await session.save();

  return NextResponse.json({
    ok: true,
    user: session.user,
  });
}
