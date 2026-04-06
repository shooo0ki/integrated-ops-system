/**
 * Better Auth データ移行スクリプト
 *
 * 既存の user_accounts テーブルのデータを Better Auth テーブルにコピーする。
 * - ba_user: id = user_accounts.id (リレーション維持のため同一ID)
 * - ba_account: credential provider として password_hash をコピー
 *
 * 実行方法:
 *   npx ts-node --project tsconfig.seed.json prisma/migrate-auth.ts
 *
 * 冪等性: 既存レコードはスキップするため、再実行しても安全。
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.userAccount.findMany({
    include: { member: { select: { name: true } } },
  });

  console.log(`Found ${accounts.length} user accounts to migrate.`);

  let created = 0;
  let skipped = 0;

  for (const account of accounts) {
    // ba_user が既に存在するかチェック (冪等性)
    const existing = await prisma.baUser.findUnique({
      where: { id: account.id },
    });

    if (existing) {
      console.log(`  SKIP: ${account.email} (already migrated)`);
      skipped++;
      continue;
    }

    await prisma.$transaction([
      // ba_user 作成 (id を user_accounts.id と一致させる)
      prisma.baUser.create({
        data: {
          id: account.id,
          email: account.email,
          name: account.member.name,
          emailVerified: true, // 既存ユーザーは検証済みとみなす
        },
      }),
      // ba_account 作成 (credential provider)
      prisma.baAccount.create({
        data: {
          userId: account.id,
          accountId: account.email,
          providerId: "credential",
          password: account.passwordHash,
        },
      }),
    ]);

    console.log(`  OK: ${account.email}`);
    created++;
  }

  console.log(`\nMigration complete: ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
