import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendEnvelope } from "@/lib/docusign";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

function formatJpDate(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

// POST /api/members/[id]/contracts/[cId]/send
// admin のみ: DocuSign 署名依頼を送付（テンプレート方式）
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; cId: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id: memberId, cId } = params;

  const contract = await prisma.memberContract.findFirst({
    where: { id: cId, memberId },
    include: {
      member: {
        select: {
          name: true,
          address: true,
          bankName: true,
          bankBranch: true,
          bankAccountNumber: true,
          bankAccountHolder: true,
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "契約が見つかりません" } }, { status: 404 });
  }

  if (contract.status !== "draft") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "送付できるのはドラフト状態の契約のみです" } },
      { status: 400 }
    );
  }

  if (!contract.docusignTemplateId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "DocuSign テンプレートが設定されていません。契約を再作成してテンプレートを選択してください。" } },
      { status: 400 }
    );
  }

  // DocuSign テンプレート方式で送付
  const m = contract.member;
  const { envelopeId } = await sendEnvelope({
    templateId: contract.docusignTemplateId,
    signerEmail: contract.signerEmail,
    signerName: m.name,
    prefillTabs: {
      contractorName: m.name,
      startDate: contract.startDate ? formatJpDate(contract.startDate) : undefined,
      endDate: contract.endDate ? formatJpDate(contract.endDate) : undefined,
      address: m.address ?? undefined,
      bankName: m.bankName ?? undefined,
      bankBranch: m.bankBranch ?? undefined,
      bankAccountNumber: m.bankAccountNumber ?? undefined,
      bankAccountHolder: m.bankAccountHolder ?? undefined,
    },
  });

  const updated = await prisma.memberContract.update({
    where: { id: cId },
    data: {
      status: "sent",
      envelopeId,
      sentAt: new Date(),
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    envelopeId: updated.envelopeId,
    sentAt: updated.sentAt?.toISOString() ?? null,
  });
}
