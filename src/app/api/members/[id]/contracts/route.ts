import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// GET /api/members/[id]/contracts
// admin: 誰でも。その他: 自分のみ
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = params;
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
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id: memberId } = params;

  // メンバー存在確認
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } }, { status: 404 });
  }

  const body = await req.json() as {
    templateName: string;
    docusignTemplateId?: string;
    startDate?: string;
    endDate?: string;
    signerEmail: string;
  };

  if (!body.templateName || !body.signerEmail) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "templateName と signerEmail は必須です" } },
      { status: 400 }
    );
  }

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
