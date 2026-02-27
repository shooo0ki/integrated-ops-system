import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInvoiceExcel } from "@/lib/invoice-excel";

function calcAmounts(items: { amount: number; taxable?: boolean }[]) {
  const taxableTotal = items.filter((i) => i.taxable !== false).reduce((s, i) => s + i.amount, 0);
  const nonTaxableTotal = items.filter((i) => i.taxable === false).reduce((s, i) => s + i.amount, 0);
  return {
    amountExclTax: taxableTotal,
    expenseAmount: nonTaxableTotal,
    amountInclTax: Math.round(taxableTotal * 1.1) + nonTaxableTotal,
  };
}

// POST /api/invoices/generate — DB保存 + Excel生成 + ファイル返却
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    targetMonth: string;
    items: { name: string; amount: number; taxable?: boolean; linkedProjectId?: string }[];
    note?: string;
  };

  const { targetMonth, items, note } = body;

  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ error: "targetMonth は YYYY-MM 形式で指定してください" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items は1件以上必要です" }, { status: 400 });
  }

  const { amountExclTax, expenseAmount, amountInclTax } = calcAmounts(items);

  const existing = await prisma.invoice.findUnique({
    where: { memberId_targetMonth: { memberId: user.memberId, targetMonth } },
  });

  let inv: { id: string; invoiceNumber: string };

  if (existing) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    inv = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        amountExclTax,
        expenseAmount,
        amountInclTax,
        issuedAt: new Date(),
        status: "sent",
        items: {
          create: items.map((item, idx) => ({
            name: item.name,
            amount: item.amount,
            sortOrder: idx,
            taxable: item.taxable !== false,
            linkedProjectId: item.linkedProjectId ?? null,
          })),
        },
      },
    });
  } else {
    const countThisMonth = await prisma.invoice.count({ where: { targetMonth } });
    const invoiceNumber = `INV-${targetMonth.replace("-", "")}-${String(countThisMonth + 1).padStart(4, "0")}`;
    inv = await prisma.invoice.create({
      data: {
        invoiceNumber,
        memberId: user.memberId,
        targetMonth,
        workHoursTotal: 0,
        unitPrice: 0,
        amountExclTax,
        expenseAmount,
        amountInclTax,
        issuedAt: new Date(),
        status: "sent",
        items: {
          create: items.map((item, idx) => ({
            name: item.name,
            amount: item.amount,
            sortOrder: idx,
            taxable: item.taxable !== false,
            linkedProjectId: item.linkedProjectId ?? null,
          })),
        },
      },
    });
  }

  const memberInfo = await prisma.member.findUnique({
    where: { id: user.memberId },
    select: {
      address: true,
      bankName: true,
      bankBranch: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
    },
  });

  const buffer = await generateInvoiceExcel({
    invoiceNumber: inv.invoiceNumber,
    targetMonth,
    issuerName: user.name,
    items,
    note,
    memberInfo,
  });

  const filename = `invoice-${targetMonth}-${inv.invoiceNumber}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
