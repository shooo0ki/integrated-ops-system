import { NextRequest, NextResponse } from "next/server";
import { type MemberContractStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/docusign";

// DocuSign Connect Webhook ステータスマッピング
const DOCUSIGN_STATUS_MAP: Record<string, MemberContractStatus> = {
  sent: "sent",
  delivered: "waiting_sign",
  completed: "completed",
  declined: "voided",
  voided: "voided",
};

// POST /api/webhooks/docusign
// DocuSign Connect からの署名ステータス通知
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // HMAC 署名検証
  const signatureHeader = req.headers.get("x-docusign-signature-1") ?? "";
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    envelopeId?: string;
    status?: string;
    completedDateTime?: string;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { envelopeId, status: dsStatus, completedDateTime } = payload;

  if (!envelopeId || !dsStatus) {
    return NextResponse.json({ error: "Missing envelopeId or status" }, { status: 400 });
  }

  const newStatus = DOCUSIGN_STATUS_MAP[dsStatus.toLowerCase()];
  if (!newStatus) {
    // 未知のステータスは無視
    return NextResponse.json({ ok: true });
  }

  // envelopeId で契約を特定してステータス更新
  const contract = await prisma.memberContract.findFirst({
    where: { envelopeId },
  });

  if (!contract) {
    console.error(`[docusign] unknown envelopeId: ${envelopeId}`);
    return NextResponse.json({ ok: true });
  }

  await prisma.memberContract.update({
    where: { id: contract.id },
    data: {
      status: newStatus,
      ...(newStatus === "completed" && completedDateTime
        ? { completedAt: new Date(completedDateTime) }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
