import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getDocumentDownloadUrl } from "@/lib/docusign";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// GET /api/members/[id]/contracts/[cId]/download-url
// admin: 誰でも。その他: 自分の契約のみ
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; cId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId, cId } = params;
  const isAdmin = user.role === "admin";

  if (!isAdmin && user.memberId !== memberId) return forbidden();

  const contract = await prisma.memberContract.findFirst({
    where: { id: cId, memberId },
  });

  if (!contract) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, { status: 404 });
  }

  if (contract.status !== "completed") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "締結完了した契約のみダウンロード可能です" } },
      { status: 400 }
    );
  }

  if (!contract.envelopeId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "envelopeId がありません" } },
      { status: 400 }
    );
  }

  const url = await getDocumentDownloadUrl(contract.envelopeId);
  return NextResponse.json({ url });
}
