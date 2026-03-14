import { PrismaClient } from "@prisma/client";

// PrismaClient はグローバルシングルトンとして管理する
// （Next.js の Hot Reload で重複インスタンスが作られるのを防ぐ）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
