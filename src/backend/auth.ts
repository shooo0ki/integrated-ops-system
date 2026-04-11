import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { hash, compare } from "bcryptjs";
import { prisma } from "./db";

// 型定義は shared から re-export (クライアントからも安全に参照可能)
export type { AppRole, SessionUser } from "@/shared/types/auth";
import type { AppRole, SessionUser } from "@/shared/types/auth";

// ─────────────────────────────────────────────
// Better Auth 設定
// ─────────────────────────────────────────────

function validateAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32"
    );
  }
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters long.");
  }
  return secret;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: validateAuthSecret(),
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
    modelName: "BaUser",
  },
  account: {
    modelName: "BaAccount",
  },
  session: {
    modelName: "BaSession",
    expiresIn: 60 * 60 * 24,  // 24時間 (要件 C-01 v2)
    updateAge: 60 * 60,        // 1時間ごとにセッション更新
    cookieCache: {
      enabled: true,
      maxAge: 60,              // 1分 (セッション無効化の遅延を最小化)
    },
  },
  verification: {
    modelName: "BaVerification",
  },
  advanced: {
    cookiePrefix: "salt2",
    generateId: () => crypto.randomUUID(),
  },
});

// ─────────────────────────────────────────────
// 互換レイヤー: 既存 API Route (68本) への影響をゼロにする
// ─────────────────────────────────────────────

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
    name: session.user.name ?? account.email.split("@")[0],
  };
}
