export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { getDocumentDownloadUrl } from "@/backend/docusign";


// GET /api/members/[id]/contracts/[cId]/download-url
// admin: 誰でも。その他: 自分の契約のみ
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId, cId } = await params;
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
