import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/invoices?month=YYYY-MM — admin/manager: all invoices for the month
// GET /api/invoices?month=YYYY-MM&mine=1 — member: own invoice
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const mine = searchParams.get("mine") === "1";

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month は YYYY-MM 形式で指定してください" }, { status: 400 });
  }

  const isAdmin = user.role === "admin" || user.role === "manager";

  if (!isAdmin || mine) {
    // 自分の請求書のみ
    const inv = await prisma.invoice.findUnique({
      where: { memberId_targetMonth: { memberId: user.memberId, targetMonth: month } },
      include: { member: { select: { name: true, salaryType: true } } },
    });
    if (!inv) return NextResponse.json(null);
    return NextResponse.json({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      targetMonth: inv.targetMonth,
      workHoursTotal: Number(inv.workHoursTotal),
      unitPrice: inv.unitPrice,
      amountExclTax: inv.amountExclTax,
      amountInclTax: inv.amountInclTax,
      filePath: inv.filePath,
      slackSentStatus: inv.slackSentStatus,
      issuedAt: inv.issuedAt.toISOString().slice(0, 10),
    });
  }

  // admin: all invoices for the month
  const invoices = await prisma.invoice.findMany({
    where: { targetMonth: month },
    include: {
      member: { select: { name: true, salaryType: true, salaryAmount: true, status: true } },
    },
    orderBy: { member: { name: "asc" } },
  });

  return NextResponse.json(
    invoices.map((inv) => ({
      id: inv.id,
      memberId: inv.memberId,
      memberName: inv.member.name,
      salaryType: inv.member.salaryType,
      invoiceNumber: inv.invoiceNumber,
      targetMonth: inv.targetMonth,
      workHoursTotal: Number(inv.workHoursTotal),
      unitPrice: inv.unitPrice,
      amountExclTax: inv.amountExclTax,
      amountInclTax: inv.amountInclTax,
      slackSentStatus: inv.slackSentStatus,
      issuedAt: inv.issuedAt.toISOString().slice(0, 10),
    }))
  );
}

// POST /api/invoices — member generates their invoice
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    targetMonth: string;
    workHoursTotal: number;
    unitPrice: number;
    note?: string;
  };

  const { targetMonth, workHoursTotal, unitPrice } = body;
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ error: "targetMonth は YYYY-MM 形式で指定してください" }, { status: 400 });
  }

  const amountExclTax = Math.round(workHoursTotal * unitPrice);
  const amountInclTax = Math.round(amountExclTax * 1.1);

  // 重複チェック
  const existing = await prisma.invoice.findUnique({
    where: { memberId_targetMonth: { memberId: user.memberId, targetMonth } },
  });
  if (existing) {
    return NextResponse.json({ error: "すでに請求書が生成されています" }, { status: 409 });
  }

  // 請求書番号生成: INV-YYYYMM-XXXX
  const countThisMonth = await prisma.invoice.count({ where: { targetMonth } });
  const invoiceNumber = `INV-${targetMonth.replace("-", "")}-${String(countThisMonth + 1).padStart(4, "0")}`;

  const inv = await prisma.invoice.create({
    data: {
      invoiceNumber,
      memberId: user.memberId,
      targetMonth,
      workHoursTotal,
      unitPrice,
      amountExclTax,
      amountInclTax,
      issuedAt: new Date(),
    },
  });

  return NextResponse.json({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    amountExclTax: inv.amountExclTax,
    amountInclTax: inv.amountInclTax,
  }, { status: 201 });
}
