export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized } from "@/backend/api-response";

// GET /api/admin/auth-migration?mode=dry-run
// GET /api/admin/auth-migration?mode=live
//
// 既存の user_accounts → ba_user + ba_account にデータをコピーする。
// ba_user.id = user_accounts.id とすることで、既存リレーションを維持する。
// 既に ba_user が存在するユーザーはスキップする（何度実行しても安全）。
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "dry-run";
  const dryRun = mode !== "live";

  const results: string[] = [];
  results.push(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);

  // 既存の user_accounts を全件取得（member.name も必要）
  const userAccounts = await prisma.userAccount.findMany({
    select: {
      id: true,
      email: true,
      passwordHash: true,
      member: { select: { name: true } },
    },
  });

  // 既に ba_user に存在するユーザーを取得
  const existingBaUsers = await prisma.baUser.findMany({
    select: { id: true },
  });
  const existingIds = new Set(existingBaUsers.map((u) => u.id));

  // 移行対象 = ba_user にまだ存在しない user_accounts
  const targets = userAccounts.filter((ua) => !existingIds.has(ua.id));

  results.push(`[Auth] Total user_accounts: ${userAccounts.length}, already migrated: ${existingIds.size}, needs migration: ${targets.length}`);

  if (!dryRun && targets.length > 0) {
    // トランザクションで一括作成
    await prisma.$transaction(async (tx) => {
      for (const ua of targets) {
        // ba_user 作成
        await tx.baUser.create({
          data: {
            id: ua.id,
            email: ua.email,
            name: ua.member.name,
            emailVerified: true,
          },
        });

        // ba_account 作成（credential provider）
        await tx.baAccount.create({
          data: {
            userId: ua.id,
            accountId: ua.email,
            providerId: "credential",
            password: ua.passwordHash,
          },
        });
      }
    });

    results.push(`[Auth] Migrated ${targets.length} users`);
  }

  results.push(dryRun ? "Dry run complete. No data was modified." : "Migration complete.");

  return NextResponse.json({ ok: true, results });
}
