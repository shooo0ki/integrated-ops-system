import { NextRequest, NextResponse } from "next/server";
import { type MemberContractStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";

const newMemberContractSchema = z.object({
  memberType: z.literal("new"),
  name: z.string().min(1).max(100),
  email: z.email(),
  status: z.enum(["executive", "employee", "intern_full", "intern_training", "training_member"]),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  bankName: z.string().max(100).optional(),
  bankBranch: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(20).optional(),
  bankAccountHolder: z.string().max(100).optional(),
  templateName: z.string().min(1),
  docusignTemplateId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const existingMemberContractSchema = z.object({
  memberType: z.literal("existing"),
  memberId: z.string().min(1),
  signerEmail: z.email(),
  templateName: z.string().min(1),
  docusignTemplateId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// POST /api/contracts
// admin のみ: 新規メンバー or 既存メンバーに対して契約ドラフトを作成
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.memberType) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "memberType は必須です" } },
      { status: 400 }
    );
  }

  if (body.memberType === "new") {
    const parsed = newMemberContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // メールアドレス重複チェック（UserAccount）
    const existing = await prisma.userAccount.findUnique({ where: { email: d.email } });
    if (existing) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "そのメールアドレスはすでに登録されています" } },
        { status: 409 }
      );
    }

    // ステータスからロールを導出
    const role =
      d.status === "executive" ? "admin" :
      d.status === "employee" ? "manager" : "member";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Member + UserAccount + Contract をトランザクションで作成
    const [, contract] = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          name: d.name,
          status: d.status,
          phone: d.phone ?? null,
          address: d.address ?? null,
          bankName: d.bankName ?? null,
          bankBranch: d.bankBranch ?? null,
          bankAccountNumber: d.bankAccountNumber ?? null,
          bankAccountHolder: d.bankAccountHolder ?? null,
          salaryType: "monthly",
          salaryAmount: 0,
          joinedAt: today,
        },
      });

      // UserAccount を作成（仮パスワードなし: 初回ログインはパスワードリセット運用想定）
      await tx.userAccount.create({
        data: {
          email: d.email,
          passwordHash: "",   // 管理者が後で設定する
          role,
          memberId: member.id,
        },
      });

      const c = await tx.memberContract.create({
        data: {
          memberId: member.id,
          templateName: d.templateName,
          docusignTemplateId: d.docusignTemplateId ?? null,
          signerEmail: d.email,
          status: "draft",
          startDate: d.startDate ? new Date(d.startDate) : null,
          endDate: d.endDate ? new Date(d.endDate) : null,
        },
      });

      return [member, c];
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

  // memberType === "existing"
  const parsed = existingMemberContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const member = await prisma.member.findUnique({ where: { id: d.memberId } });
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
      { status: 404 }
    );
  }

  const contract = await prisma.memberContract.create({
    data: {
      memberId: d.memberId,
      templateName: d.templateName,
      docusignTemplateId: d.docusignTemplateId ?? null,
      signerEmail: d.signerEmail,
      status: "draft",
      startDate: d.startDate ? new Date(d.startDate) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
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

// GET /api/contracts?memberId=&status=
// admin のみ全契約一覧を取得
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const contracts = await prisma.memberContract.findMany({
    where: {
      ...(memberId ? { memberId } : {}),
      ...(status ? { status: status as MemberContractStatus } : {}),
    },
    include: {
      member: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    contracts.map((c) => ({
      id: c.id,
      memberId: c.memberId,
      memberName: c.member.name,
      signerEmail: c.signerEmail,
      status: c.status,
      templateName: c.templateName,
      docusignTemplateId: c.docusignTemplateId ?? null,
      envelopeId: c.envelopeId,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      fileUrl: c.fileUrl,
      sentAt: c.sentAt?.toISOString() ?? null,
      completedAt: c.completedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }))
  );
}
