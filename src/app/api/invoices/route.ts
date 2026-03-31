export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { unauthorized, apiError } from "@/backend/api-response";

// items の消費税計算ヘルパー
// 稼働分（taxable=true）のみ10%課税。経費・交通費（taxable=false）は非課税
function calcAmounts(items: { amount: number; taxable?: boolean }[]) {
  const taxableTotal = items.filter((i) => i.taxable !== false).reduce((s, i) => s + i.amount, 0);
  const nonTaxableTotal = items.filter((i) => i.taxable === false).reduce((s, i) => s + i.amount, 0);
  return {
    amountExclTax: taxableTotal,
    expenseAmount: nonTaxableTotal,
    amountInclTax: Math.round(taxableTotal * 1.1) + nonTaxableTotal,
  };
}

// GET /api/invoices?month=YYYY-MM — admin/manager: all invoices for the month
// GET /api/invoices?month=YYYY-MM&mine=1 — member: own invoice
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const mine = searchParams.get("mine") === "1";

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return apiError("VALIDATION_ERROR", "month は YYYY-MM 形式で指定してください", 400);
  }

  const isAdmin = user.role === "admin" || user.role === "manager";

  if (!isAdmin || mine) {
    const inv = await prisma.invoice.findUnique({
      where: { memberId_targetMonth: { memberId: user.memberId, targetMonth: month } },
      include: {
        member: { select: { name: true, salaryType: true } },
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!inv) return NextResponse.json(null);
    return NextResponse.json({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      targetMonth: inv.targetMonth,
      workHoursTotal: Number(inv.workHoursTotal),
      unitPrice: inv.unitPrice,
      amountExclTax: inv.amountExclTax,
      expenseAmount: inv.expenseAmount,
      amountInclTax: inv.amountInclTax,
      filePath: inv.filePath,
      status: inv.status,
      issuedAt: inv.issuedAt.toISOString().slice(0, 10),
      items: inv.items.map((item) => ({
        id: item.id,
        name: item.name,
        amount: item.amount,
        sortOrder: item.sortOrder,
        taxable: item.taxable,
        linkedProjectId: item.linkedProjectId,
      })),
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: { targetMonth: month },
    include: {
      member: { select: { name: true, salaryType: true, salaryAmount: true, status: true } },
      items: { orderBy: { sortOrder: "asc" } },
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
      expenseAmount: inv.expenseAmount,
      amountInclTax: inv.amountInclTax,
      status: inv.status,
      issuedAt: inv.issuedAt.toISOString().slice(0, 10),
      items: inv.items.map((item) => ({
        id: item.id,
        name: item.name,
        amount: item.amount,
        taxable: item.taxable,
        sortOrder: item.sortOrder,
      })),
    }))
  );
}

// POST /api/invoices — member generates their invoice (upsert + items)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json() as {
    targetMonth: string;
    workHoursTotal: number;
    unitPrice: number;
    items: { name: string; amount: number; taxable?: boolean; linkedProjectId?: string }[];
    note?: string;
  };

  const { targetMonth, workHoursTotal, unitPrice, items } = body;
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return apiError("VALIDATION_ERROR", "targetMonth は YYYY-MM 形式で指定してください", 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return apiError("VALIDATION_ERROR", "items は1件以上必要です", 400);
  }

  const { amountExclTax, expenseAmount, amountInclTax } = calcAmounts(items);

  const existing = await prisma.invoice.findUnique({
    where: { memberId_targetMonth: { memberId: user.memberId, targetMonth } },
  });

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "127.0.0.1";

  if (existing) {
    const inv = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      const updated = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          workHoursTotal,
          unitPrice,
          amountExclTax,
          expenseAmount,
          amountInclTax,
          issuedAt: new Date(),
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
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });

      await tx.auditLog.create({
        data: {
          operatorId: user.id,
          targetTable: "invoices",
          targetId: updated.id,
          action: "UPDATE",
          beforeData: { amountExclTax: existing.amountExclTax, amountInclTax: existing.amountInclTax },
          afterData: { amountExclTax, amountInclTax, targetMonth },
          ipAddress: ip,
        },
      });

      return updated;
    });

    return NextResponse.json({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amountExclTax: inv.amountExclTax,
      expenseAmount: inv.expenseAmount,
      amountInclTax: inv.amountInclTax,
      items: inv.items,
    });
  }

  const inv = await prisma.$transaction(async (tx) => {
    const countThisMonth = await tx.invoice.count({ where: { targetMonth } });
    const invoiceNumber = `INV-${targetMonth.replace("-", "")}-${String(countThisMonth + 1).padStart(4, "0")}`;

    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        memberId: user.memberId,
        targetMonth,
        workHoursTotal,
        unitPrice,
        amountExclTax,
        expenseAmount,
        amountInclTax,
        issuedAt: new Date(),
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
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "invoices",
        targetId: created.id,
        action: "CREATE",
        afterData: { invoiceNumber, targetMonth, amountExclTax, amountInclTax },
        ipAddress: ip,
      },
    });

    return created;
  });

  return NextResponse.json({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    amountExclTax: inv.amountExclTax,
    expenseAmount: inv.expenseAmount,
    amountInclTax: inv.amountInclTax,
    items: inv.items,
  }, { status: 201 });
}
