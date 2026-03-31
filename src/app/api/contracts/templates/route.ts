export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getTemplates } from "@/backend/docusign";


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
