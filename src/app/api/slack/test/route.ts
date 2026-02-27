import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendSlack } from "@/lib/slack";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendSlack("✅ Slack 接続テスト成功（統合業務管理システム）");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Slack 送信に失敗しました" }, { status: 500 });
  }
}
