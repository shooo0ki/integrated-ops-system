export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { z } from "zod";

const createContractSchema = z.object({
  templateName: z.string().min(1).max(200),
  docusignTemplateId: z.string().max(200).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  signerEmail: z.string().email().max(255),
});

// GET /api/members/[id]/contracts
// admin: 誰でも。その他: 自分のみ
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = await params;
  const isAdmin = user.role === "admin";

  if (!isAdmin && user.memberId !== memberId) return forbidden();

  const contracts = await prisma.memberContract.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    contracts.map((c) => ({
      id: c.id,
      memberId: c.memberId,
      status: c.status,
      templateName: c.templateName,
      docusignTemplateId: c.docusignTemplateId ?? null,
      envelopeId: c.envelopeId,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      fileUrl: c.fileUrl,
      signerEmail: c.signerEmail,
      sentAt: c.sentAt?.toISOString() ?? null,
      completedAt: c.completedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}

// POST /api/members/[id]/contracts
// admin のみ: 契約ドラフト作成
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id: memberId } = await params;

  // メンバー存在確認
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = createContractSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.issues.map((i) => i.message).join(", ") } },
      { status: 400 }
    );
  }

  const body = parsed.data;

  const contract = await prisma.memberContract.create({
    data: {
      memberId,
      templateName: body.templateName,
      docusignTemplateId: body.docusignTemplateId ?? null,
      signerEmail: body.signerEmail,
      status: "draft",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });

  return NextResponse.json(
    {
      id: contract.id,
      memberId: contract.memberId,
      status: contract.status,
      templateName: contract.templateName,
      docusignTemplateId: contract.docusignTemplateId ?? null,
      signerEmail: contract.signerEmail,
      startDate: contract.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
      createdAt: contract.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
