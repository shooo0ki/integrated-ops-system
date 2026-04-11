export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { encrypt } from "@/backend/crypto";
import { unauthorized } from "@/backend/api-response";

const ENCRYPTED_PREFIX = "enc:";

function isEncrypted(value: string | null): boolean {
  return value !== null && value.startsWith(ENCRYPTED_PREFIX);
}

// GET /api/admin/encrypt-migration?mode=dry-run
// GET /api/admin/encrypt-migration?mode=live
export async function GET(req: NextRequest) {
  // CRON_SECRET による認証（Cron エンドポイントと同じ方式）
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "dry-run";
  const dryRun = mode !== "live";

  const results: string[] = [];
  results.push(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);

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

  results.push(`[Bank] Total members: ${members.length}, needs encryption: ${bankTargets.length}`);

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
    results.push(`[Bank] Encrypted ${bankTargets.length} members`);
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

  results.push(`[OAuth] Total tokens: ${tokens.length}, needs encryption: ${tokenTargets.length}`);

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
    results.push(`[OAuth] Encrypted ${tokenTargets.length} tokens`);
  }

  results.push(dryRun ? "Dry run complete. No data was modified." : "Migration complete.");

  return NextResponse.json({ ok: true, results });
}
