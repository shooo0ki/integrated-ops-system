export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized } from "@/backend/api-response";

// Warmup エンドポイント: Vercel Cron から5分ごとに呼ばれ、
// Serverless 関数とDBコネクションを温め続ける
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  // 軽量なクエリでDBコネクションプールを初期化
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true, ts: Date.now() });
}
