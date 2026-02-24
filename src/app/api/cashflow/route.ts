import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// GET /api/cashflow?company=boost|salt2&months=YYYY-MM,...
// or: GET /api/cashflow?company=boost|salt2&month=YYYY-MM
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const url = new URL(req.url);
  const company = url.searchParams.get("company") ?? "boost";
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

  // 月次給与自動計算（当該会社の月給制メンバー合計）
  const salaryAgg = await prisma.member.aggregate({
    where: { company, deletedAt: null, salaryType: "monthly" },
    _sum: { salaryAmount: true },
  });
  const autoSalary = salaryAgg._sum.salaryAmount ?? 0;

  const records = await Promise.all(
    targetMonths.map(async (targetMonth) => {
      const rec = await prisma.pLRecord.findFirst({
        where: { recordType: "cf", targetMonth, memo: company },
      });
      return {
        month: targetMonth,
        company,
        openingBalance: rec?.cfBalancePrev ?? 0,
        cashInClient: rec?.cfCashInClient ?? 0,
        cashInOther: rec?.cfCashInOther ?? 0,
        cashOutSalary: autoSalary,
        cashOutFreelance: rec?.cfCashOutOutsourcing ?? 0,
        cashOutFixed: rec?.cfCashOutFixed ?? 0,
        cashOutOther: rec?.cfCashOutOther ?? 0,
        cfBalanceCurrent: rec?.cfBalanceCurrent ?? 0,
      };
    })
  );

  return NextResponse.json(records.length === 1 ? records[0] : records);
}

// PUT /api/cashflow
// Body: { month, company, cashInClient, cashInOther, cashOutFreelance, cashOutFixed, cashOutOther, openingBalance }
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const { month, company, cashInClient, cashInOther, cashOutFreelance, cashOutFixed, cashOutOther, openingBalance } =
    body ?? {};

  if (!month || !company) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month, company は必須です" } },
      { status: 400 }
    );
  }

  // 月次給与自動計算
  const salaryAgg = await prisma.member.aggregate({
    where: { company, deletedAt: null, salaryType: "monthly" },
    _sum: { salaryAmount: true },
  });
  const autoSalary = salaryAgg._sum.salaryAmount ?? 0;

  const cashIn = (cashInClient ?? 0) + (cashInOther ?? 0);
  const cashOut = autoSalary + (cashOutFreelance ?? 0) + (cashOutFixed ?? 0) + (cashOutOther ?? 0);
  const cfBalanceCurrent = (openingBalance ?? 0) + cashIn - cashOut;

  const existing = await prisma.pLRecord.findFirst({
    where: { recordType: "cf", targetMonth: month, memo: company },
  });

  let record;
  if (existing) {
    record = await prisma.pLRecord.update({
      where: { id: existing.id },
      data: {
        cfCashInClient: cashInClient ?? 0,
        cfCashInOther: cashInOther ?? 0,
        cfCashOutSalary: autoSalary,
        cfCashOutOutsourcing: cashOutFreelance ?? 0,
        cfCashOutFixed: cashOutFixed ?? 0,
        cfCashOutOther: cashOutOther ?? 0,
        cfBalancePrev: openingBalance ?? 0,
        cfBalanceCurrent,
      },
    });
  } else {
    record = await prisma.pLRecord.create({
      data: {
        recordType: "cf",
        targetMonth: month,
        memo: company,
        cfCashInClient: cashInClient ?? 0,
        cfCashInOther: cashInOther ?? 0,
        cfCashOutSalary: autoSalary,
        cfCashOutOutsourcing: cashOutFreelance ?? 0,
        cfCashOutFixed: cashOutFixed ?? 0,
        cfCashOutOther: cashOutOther ?? 0,
        cfBalancePrev: openingBalance ?? 0,
        cfBalanceCurrent,
        createdBy: user.id,
      },
    });
  }

  return NextResponse.json({
    month: record.targetMonth,
    company,
    openingBalance: record.cfBalancePrev ?? 0,
    cashInClient: record.cfCashInClient,
    cashInOther: record.cfCashInOther,
    cashOutSalary: autoSalary,
    cashOutFreelance: record.cfCashOutOutsourcing,
    cashOutFixed: record.cfCashOutFixed,
    cashOutOther: record.cfCashOutOther,
    cfBalanceCurrent: record.cfBalanceCurrent,
  });
}
