export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { sendSlack } from "@/backend/slack";
import { unauthorized, apiError } from "@/backend/api-response";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return unauthorized();
  }

  try {
    await sendSlack("✅ Slack 接続テスト成功（統合業務管理システム）");
    return NextResponse.json({ ok: true });
  } catch {
    return apiError("INTERNAL_ERROR", "Slack 送信に失敗しました", 500);
  }
}
