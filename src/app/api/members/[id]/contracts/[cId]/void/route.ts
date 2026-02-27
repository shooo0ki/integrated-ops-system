import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { voidEnvelope } from "@/lib/docusign";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// PUT /api/members/[id]/contracts/[cId]/void
// admin のみ: 契約を無効化
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; cId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id: memberId, cId } = params;

  const contract = await prisma.memberContract.findFirst({
    where: { id: cId, memberId },
  });

  if (!contract) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, { status: 404 });
  }

  if (contract.status === "voided") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "既に無効化されています" } },
      { status: 400 }
    );
  }

  const body = (await req.json()) as { reason?: string };
  const reason = body.reason ?? "管理者により無効化";

  // DocuSign エンベロープが存在する場合は無効化
  if (contract.envelopeId) {
    await voidEnvelope(contract.envelopeId, reason);
  }

  const updated = await prisma.memberContract.update({
    where: { id: cId },
    data: { status: "voided" },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
