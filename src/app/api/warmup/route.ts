export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/db";

// Warmup エンドポイント: Vercel Cron から5分ごとに呼ばれ、
// Serverless 関数とDBコネクションを温め続ける
export async function GET() {
  // 軽量なクエリでDBコネクションプールを初期化
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true, ts: Date.now() });
}
