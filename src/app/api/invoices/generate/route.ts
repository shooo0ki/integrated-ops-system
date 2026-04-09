export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { generateInvoicePdf } from "@/backend/invoice-pdf";
import { uploadFile } from "@/backend/storage";
import { decryptBankFields } from "@/backend/crypto";
import { unauthorized, apiError } from "@/backend/api-response";
import { z } from "zod";

const invoiceGenerateSchema = z.object({
  targetMonth: z.string().regex(/^\d{4}-\d{2}$/, "targetMonth は YYYY-MM 形式で指定してください"),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    amount: z.number().min(0).max(99_999_999),
    taxable: z.boolean().optional(),
    linkedProjectId: z.string().optional(),
  })).min(1, "items は1件以上必要です"),
  note: z.string().max(1000).optional(),
});

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

  const raw = await req.json().catch(() => null);
  const parsed = invoiceGenerateSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const { targetMonth, items, note } = parsed.data;

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

  const member = await prisma.member.findUnique({
    where: { id: user.memberId },
    select: {
      salaryAmount: true,
      phone: true,
      address: true,
      bankName: true,
      bankBranch: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
    },
  });

  const invoice = existing
    ? await prisma.invoice.findUnique({ where: { id: inv.id }, select: { issuedAt: true, unitPrice: true, workHoursTotal: true } })
    : { issuedAt: new Date(), unitPrice: member?.salaryAmount ?? 0, workHoursTotal };

  const buffer = await generateInvoicePdf({
    invoiceNumber: inv.invoiceNumber,
    targetMonth,
    issuerName: user.name,
    issuedAt: (invoice?.issuedAt ?? new Date()).toISOString().slice(0, 10),
    unitPrice: Number(invoice?.unitPrice ?? member?.salaryAmount ?? 0),
    workHoursTotal: Number(invoice?.workHoursTotal ?? workHoursTotal),
    items,
    note,
    memberInfo: {
      phone: member?.phone,
      address: member?.address,
      ...decryptBankFields({
        bankName: member?.bankName,
        bankBranch: member?.bankBranch,
        bankAccountNumber: member?.bankAccountNumber,
        bankAccountHolder: member?.bankAccountHolder,
      }),
    },
  });

  // Blob Storage にアップロード（BLOB_READ_WRITE_TOKEN 設定時のみ）
  const storagePath = `invoices/${targetMonth}/${inv.invoiceNumber}.pdf`;
  const uploaded = await uploadFile(storagePath, buffer);
  if (uploaded) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { filePath: uploaded.url },
    });
  }

  const filename = `invoice-${targetMonth}-${inv.invoiceNumber}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
