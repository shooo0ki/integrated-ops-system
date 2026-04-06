import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { hash, compare } from "bcryptjs";
import { prisma } from "./db";

// ─────────────────────────────────────────────
// Better Auth 設定
// ─────────────────────────────────────────────

function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32"
    );
  }
  return secret;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: getAuthSecret(),
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: (password: string) => hash(password, 12),
      verify: ({ password, hash: stored }) => compare(password, stored),
    },
  },
  user: {
    modelName: "BaUser",       // Prisma モデル名 → DB: ba_user
  },
  account: {
    modelName: "BaAccount",    // Prisma モデル名 → DB: ba_account
  },
  session: {
    modelName: "BaSession",    // Prisma モデル名 → DB: ba_session
    expiresIn: 60 * 60 * 24,  // 24時間 (要件 C-01 v2)
    updateAge: 60 * 60,        // 1時間ごとにセッション更新
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,          // Cookie キャッシュ 5分 (DB 問い合わせ軽減)
    },
  },
  verification: {
    modelName: "BaVerification", // Prisma モデル名 → DB: ba_verification
  },
  advanced: {
    cookiePrefix: "salt2",
    generateId: () => crypto.randomUUID(),
  },
});

// ─────────────────────────────────────────────
// 互換レイヤー: 既存 API Route (68本) への影響をゼロにする
// ─────────────────────────────────────────────

export type AppRole = "admin" | "manager" | "member";

export interface SessionUser {
  id: string;       // UserAccount.id
  memberId: string; // Member.id
  email: string;
  role: AppRole;
  name: string;
}

/**
 * 既存の全 API Route から呼ばれる関数。
 * Better Auth のセッションを取得し、従来と同じ SessionUser 型で返す。
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  // ba_user.id === user_accounts.id なので直接引ける
  const account = await prisma.userAccount.findUnique({
    where: { id: session.user.id },
    select: { id: true, memberId: true, email: true, role: true },
  });

  if (!account) return null;

  const normalizedRole: AppRole =
    account.role === "admin"
      ? "admin"
      : account.role === "manager"
        ? "manager"
        : "member";

  return {
    id: account.id,
    memberId: account.memberId,
    email: account.email,
    role: normalizedRole,
    name: session.user.name,
  };
}
