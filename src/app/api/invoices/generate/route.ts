import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { generateInvoiceExcel } from "@/backend/invoice-excel";
import { unauthorized, apiError } from "@/backend/api-response";

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
  if (!user) return unauthorized();

  const body = await req.json() as {
    targetMonth: string;
    items: { name: string; amount: number; taxable?: boolean; linkedProjectId?: string }[];
    note?: string;
  };

  const { targetMonth, items, note } = body;

  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return apiError("VALIDATION_ERROR", "targetMonth は YYYY-MM 形式で指定してください", 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return apiError("VALIDATION_ERROR", "items は1件以上必要です", 400);
  }

  // 月次申告チェック: 未申告なら請求書作成不可
  const selfReports = await prisma.monthlySelfReport.findMany({
    where: { memberId: user.memberId, targetMonth },
    select: { id: true, reportedPercent: true },
  });
  if (selfReports.length === 0) {
    return apiError("VALIDATION_ERROR", "月次工数申告が未提出です。先に工数配分を申告してください。", 400);
  }
  const totalPercent = selfReports.reduce((s, r) => s + r.reportedPercent, 0);
  if (totalPercent !== 100) {
    return apiError("VALIDATION_ERROR", `月次工数申告の合計が${totalPercent}%です。100%にしてから請求書を作成してください。`, 400);
  }

  const { amountExclTax, expenseAmount, amountInclTax } = calcAmounts(items);

  // 勤怠サマリーから最新の勤務時間を取得
  const summary = await prisma.monthlyAttendanceSummary.findUnique({
    where: { memberId_targetMonth: { memberId: user.memberId, targetMonth } },
    select: { totalMinutes: true },
  });
  const workHoursTotal = summary ? Math.round((summary.totalMinutes / 60) * 100) / 100 : 0;

  const existing = await prisma.invoice.findUnique({
    where: { memberId_targetMonth: { memberId: user.memberId, targetMonth } },
  });

  let inv: { id: string; invoiceNumber: string };

  if (existing) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    inv = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        workHoursTotal,
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
        workHoursTotal,
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
