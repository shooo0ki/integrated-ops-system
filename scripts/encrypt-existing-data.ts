/**
 * 既存の平文データを暗号化するマイグレーションスクリプト
 *
 * 使い方:
 *   npx ts-node --project tsconfig.seed.json scripts/encrypt-existing-data.ts [--dry-run]
 *
 * --dry-run: 実際には書き込まず、対象件数のみ表示
 *
 * 前提:
 *   - ENCRYPTION_KEY が環境変数に設定されていること
 *   - DATABASE_URL が本番DBを指していること
 */

import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string | null): string | null {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext; // 既に暗号化済み

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return `${ENCRYPTED_PREFIX}${combined.toString("base64")}`;
}

function isEncrypted(value: string | null): boolean {
  return value !== null && value.startsWith(ENCRYPTED_PREFIX);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();

  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log("");

  try {
    // ── 銀行口座情報 ──
    const members = await prisma.member.findMany({
      select: {
        id: true,
        bankName: true,
        bankBranch: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
      },
    });

    const bankTargets = members.filter(
      (m) =>
        (m.bankName && !isEncrypted(m.bankName)) ||
        (m.bankBranch && !isEncrypted(m.bankBranch)) ||
        (m.bankAccountNumber && !isEncrypted(m.bankAccountNumber)) ||
        (m.bankAccountHolder && !isEncrypted(m.bankAccountHolder)),
    );

    console.log(`[Bank] Total members: ${members.length}, needs encryption: ${bankTargets.length}`);

    if (!dryRun && bankTargets.length > 0) {
      await prisma.$transaction(
        bankTargets.map((m) =>
          prisma.member.update({
            where: { id: m.id },
            data: {
              bankName: encrypt(m.bankName),
              bankBranch: encrypt(m.bankBranch),
              bankAccountNumber: encrypt(m.bankAccountNumber),
              bankAccountHolder: encrypt(m.bankAccountHolder),
            },
          }),
        ),
      );
      console.log(`[Bank] Encrypted ${bankTargets.length} members`);
    }

    // ── Google OAuth トークン ──
    const tokens = await prisma.googleToken.findMany({
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    const tokenTargets = tokens.filter(
      (t) =>
        (t.accessToken && !isEncrypted(t.accessToken)) ||
        (t.refreshToken && !isEncrypted(t.refreshToken)),
    );

    console.log(`[OAuth] Total tokens: ${tokens.length}, needs encryption: ${tokenTargets.length}`);

    if (!dryRun && tokenTargets.length > 0) {
      await prisma.$transaction(
        tokenTargets.map((t) =>
          prisma.googleToken.update({
            where: { id: t.id },
            data: {
              accessToken: encrypt(t.accessToken)!,
              refreshToken: encrypt(t.refreshToken)!,
            },
          }),
        ),
      );
      console.log(`[OAuth] Encrypted ${tokenTargets.length} tokens`);
    }

    console.log("");
    console.log(dryRun ? "Dry run complete. No data was modified." : "Migration complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
