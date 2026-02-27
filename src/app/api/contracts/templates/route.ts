import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTemplates } from "@/lib/docusign";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// GET /api/contracts/templates
// admin のみ: DocuSign テンプレート一覧取得
// DocuSign 未設定の場合は空配列を返す（開発環境対応）
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  try {
    const templates = await getTemplates();
    return NextResponse.json(templates);
  } catch {
    // DocuSign 環境変数未設定など設定不備時は空配列
    return NextResponse.json([]);
  }
}
