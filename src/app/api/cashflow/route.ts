import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";

const CF_COMPANY = "salt2" as const;

// 自動計算: SALT2の入出金を取得
async function calcAutoFields(targetMonth: string, projectIds?: string[]) {
  const resolvedProjectIds = projectIds
    ? projectIds
    : (
        await prisma.project.findMany({
          where: { company: CF_COMPANY, deletedAt: null },
          select: { id: true },
        })
      ).map((p) => p.id);

  const [invoiceAgg, toolAgg, salaryAgg, expenseAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { targetMonth, status: { in: ["sent", "confirmed"] } },
      _sum: { amountSalt2: true },
    }),
    prisma.memberTool.aggregate({
      where: { companyLabel: CF_COMPANY },
      _sum: { monthlyCost: true },
    }),
    prisma.member.aggregate({
      where: { deletedAt: null, salaryType: "monthly" },
      _sum: { salaryAmount: true },
    }),
    prisma.invoiceItem.aggregate({
      where: {
        taxable: false,
        OR: [
          ...(resolvedProjectIds.length > 0 ? [{ linkedProjectId: { in: resolvedProjectIds } }] : []),
          { linkedProjectId: null },
        ],
        invoice: { targetMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  const cashInClient = invoiceAgg._sum.amountSalt2 ?? 0;
  const cashOutFixed = toolAgg._sum.monthlyCost ?? 0;
  const cashOutSalary = salaryAgg._sum.salaryAmount ?? 0;
  const cashOutExpense = expenseAgg._sum.amount ?? 0;

  return { cashInClient, cashOutFixed, cashOutSalary, cashOutExpense };
}

// オーバーライドがあればそちらを使い、なければ自動計算値を返す
function resolveField(override: number | null | undefined, auto: number): { value: number; isOverride: boolean } {
  if (override != null) return { value: override, isOverride: true };
  return { value: auto, isOverride: false };
}

// GET /api/cashflow?month=YYYY-MM&company=boost|salt2
// or: GET /api/cashflow?months=YYYY-MM,...&company=boost|salt2
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const url = new URL(req.url);
  const monthsParam = url.searchParams.get("months");
  const monthParam = url.searchParams.get("month");

  const targetMonths = monthsParam
    ? monthsParam.split(",").map((m) => m.trim()).filter((m) => /^\d{4}-\d{2}$/.test(m))
    : monthParam
    ? [monthParam]
    : [];

  if (targetMonths.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month または months は必須です" } },
      { status: 400 }
    );
  }

  const companyProjectIds = (
    await prisma.project.findMany({
      where: { company: CF_COMPANY, deletedAt: null },
      select: { id: true },
    })
  ).map((p) => p.id);

  const records = await Promise.all(
    targetMonths.map(async (targetMonth) => {
      const [rec, auto] = await Promise.all([
        prisma.pLRecord.findFirst({
          where: { recordType: "cf", targetMonth, cfCompany: CF_COMPANY },
        }),
        calcAutoFields(targetMonth, companyProjectIds),
      ]);

      const ci = resolveField(rec?.cfCashInClientOverride, auto.cashInClient);
      const cs = resolveField(rec?.cfCashOutSalaryOverride, auto.cashOutSalary);
      const cf = resolveField(rec?.cfCashOutFixedOverride, auto.cashOutFixed);
      const ce = resolveField(rec?.cfCashOutExpenseOverride, auto.cashOutExpense);

      const cashInClient = ci.value;
      const cashOutSalary = cs.value;
      const cashOutFixed = cf.value;
      const cashOutExpense = ce.value;
      const cashInOther = rec?.cfCashInOther ?? 0;
      const cashOutOther = rec?.cfCashOutOther ?? 0;
      const openingBalance = rec?.cfBalancePrev ?? 0;

      const cashIn = cashInClient + cashInOther;
      const cashOut = cashOutSalary + cashOutFixed + cashOutExpense + cashOutOther;
      const cfBalanceCurrent = openingBalance + cashIn - cashOut;

      return {
        month: targetMonth,
        company: CF_COMPANY,
        openingBalance,
        cashInClient,
        cashInOther,
        cashOutSalary,
        cashOutFixed,
        cashOutExpense,
        cashOutOther,
        cfBalanceCurrent,
        // 自動計算の参考値
        autoCashInClient: auto.cashInClient,
        autoCashOutSalary: auto.cashOutSalary,
        autoCashOutFixed: auto.cashOutFixed,
        autoCashOutExpense: auto.cashOutExpense,
        // オーバーライド状態
        overrides: {
          cashInClient: ci.isOverride,
          cashOutSalary: cs.isOverride,
          cashOutFixed: cf.isOverride,
          cashOutExpense: ce.isOverride,
        },
      };
    })
  );

  return NextResponse.json(records.length === 1 ? records[0] : records);
}

// PUT /api/cashflow
// Body: { month, company, openingBalance, cashInOther, cashOutOther,
//         cashInClientOverride?, cashOutSalaryOverride?, cashOutFixedOverride?, cashOutExpenseOverride? }
// override が null の場合は自動計算にリセット
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const {
    month,
    cashInOther, cashOutOther, openingBalance,
    cashInClientOverride, cashOutSalaryOverride, cashOutFixedOverride, cashOutExpenseOverride,
  } = body ?? {};

  if (!month) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month は必須です" } },
      { status: 400 }
    );
  }

  const auto = await calcAutoFields(month);

  const inOther = cashInOther ?? 0;
  const outOther = cashOutOther ?? 0;
  const prevBalance = openingBalance ?? 0;

  // null は「自動に戻す」、undefined は「変更しない」
  const ciOverride = cashInClientOverride !== undefined ? (cashInClientOverride ?? null) : undefined;
  const csOverride = cashOutSalaryOverride !== undefined ? (cashOutSalaryOverride ?? null) : undefined;
  const cfOverride = cashOutFixedOverride !== undefined ? (cashOutFixedOverride ?? null) : undefined;
  const ceOverride = cashOutExpenseOverride !== undefined ? (cashOutExpenseOverride ?? null) : undefined;

  const existing = await prisma.pLRecord.findFirst({
    where: { recordType: "cf", targetMonth: month, cfCompany: CF_COMPANY },
  });

  // 有効値を決定（overrideがあればそちら、なければ自動）
  const effectiveCashInClient = (ciOverride ?? existing?.cfCashInClientOverride) != null
    ? (ciOverride ?? existing?.cfCashInClientOverride)!
    : auto.cashInClient;
  const effectiveCashOutSalary = (csOverride ?? existing?.cfCashOutSalaryOverride) != null
    ? (csOverride ?? existing?.cfCashOutSalaryOverride)!
    : auto.cashOutSalary;
  const effectiveCashOutFixed = (cfOverride ?? existing?.cfCashOutFixedOverride) != null
    ? (cfOverride ?? existing?.cfCashOutFixedOverride)!
    : auto.cashOutFixed;
  const effectiveCashOutExpense = (ceOverride ?? existing?.cfCashOutExpenseOverride) != null
    ? (ceOverride ?? existing?.cfCashOutExpenseOverride)!
    : auto.cashOutExpense;

  const cashIn = effectiveCashInClient + inOther;
  const cashOut = effectiveCashOutSalary + effectiveCashOutFixed + effectiveCashOutExpense + outOther;
  const cfBalanceCurrent = prevBalance + cashIn - cashOut;

  const data = {
    cfCashInClient: auto.cashInClient,
    cfCashInOther: inOther,
    cfCashOutSalary: auto.cashOutSalary,
    cfCashOutFixed: auto.cashOutFixed,
    cfCashOutOther: outOther,
    cfBalancePrev: prevBalance,
    cfBalanceCurrent,
    ...(ciOverride !== undefined ? { cfCashInClientOverride: ciOverride } : {}),
    ...(csOverride !== undefined ? { cfCashOutSalaryOverride: csOverride } : {}),
    ...(cfOverride !== undefined ? { cfCashOutFixedOverride: cfOverride } : {}),
    ...(ceOverride !== undefined ? { cfCashOutExpenseOverride: ceOverride } : {}),
  };

  let record;
  if (existing) {
    record = await prisma.pLRecord.update({
      where: { id: existing.id },
      data,
    });
  } else {
    record = await prisma.pLRecord.create({
      data: {
        recordType: "cf",
        cfCompany: CF_COMPANY,
        targetMonth: month,
        createdBy: user.id,
        ...data,
      },
    });
  }

  return NextResponse.json({
    month: record.targetMonth,
    company: CF_COMPANY,
    openingBalance: record.cfBalancePrev ?? 0,
    cashInClient: effectiveCashInClient,
    cashInOther: record.cfCashInOther,
    cashOutSalary: effectiveCashOutSalary,
    cashOutFixed: effectiveCashOutFixed,
    cashOutExpense: effectiveCashOutExpense,
    cashOutOther: record.cfCashOutOther,
    cfBalanceCurrent: record.cfBalanceCurrent,
    autoCashInClient: auto.cashInClient,
    autoCashOutSalary: auto.cashOutSalary,
    autoCashOutFixed: auto.cashOutFixed,
    autoCashOutExpense: auto.cashOutExpense,
    overrides: {
      cashInClient: record.cfCashInClientOverride != null,
      cashOutSalary: record.cfCashOutSalaryOverride != null,
      cashOutFixed: record.cfCashOutFixedOverride != null,
      cashOutExpense: record.cfCashOutExpenseOverride != null,
    },
  });
}
