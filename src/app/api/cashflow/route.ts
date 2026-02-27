import { NextRequest, NextResponse } from "next/server";
import { type Company } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// 自動計算: 会社別の入出金を取得
async function calcAutoFields(targetMonth: string, company: Company) {
  // 当該会社に属するプロジェクトIDを取得（経費計算用）
  const companyProjects = await prisma.project.findMany({
    where: { company, deletedAt: null },
    select: { id: true },
  });
  const projectIds = companyProjects.map((p) => p.id);

  const [invoiceAgg, toolAgg, salaryAgg, expenseAgg] = await Promise.all([
    // Boost入金 / クライアント入金: 送付済み・確認済み請求書から自動集計
    prisma.invoice.aggregate({
      where: { targetMonth, status: { in: ["sent", "confirmed"] } },
      _sum: company === "boost" ? { amountBoost: true } : { amountSalt2: true },
    }),
    // 固定費: 該当会社のツールコスト合計
    prisma.memberTool.aggregate({
      where: { companyLabel: company },
      _sum: { monthlyCost: true },
    }),
    // 給与支払い: 月給制メンバー合計
    prisma.member.aggregate({
      where: { deletedAt: null, salaryType: "monthly" },
      _sum: { salaryAmount: true },
    }),
    // 経費精算:
    //   boost : 当社プロジェクトに紐づく非課税明細のみ
    //   salt2 : 当社プロジェクト紐づき + linkedProjectId: null（プロジェクト外経費）も計上
    company === "salt2"
      ? prisma.invoiceItem.aggregate({
          where: {
            taxable: false,
            OR: [
              ...(projectIds.length > 0 ? [{ linkedProjectId: { in: projectIds } }] : []),
              { linkedProjectId: null },
            ],
            invoice: { targetMonth },
          },
          _sum: { amount: true },
        })
      : projectIds.length > 0
      ? prisma.invoiceItem.aggregate({
          where: {
            taxable: false,
            linkedProjectId: { in: projectIds },
            invoice: { targetMonth },
          },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
  ]);

  const invoiceSum = invoiceAgg._sum as { amountBoost?: number | null; amountSalt2?: number | null };
  const cashInClient =
    company === "boost"
      ? (invoiceSum.amountBoost ?? 0)
      : (invoiceSum.amountSalt2 ?? 0);
  const cashOutFixed = toolAgg._sum.monthlyCost ?? 0;
  const cashOutSalary = salaryAgg._sum.salaryAmount ?? 0;
  const cashOutExpense = expenseAgg._sum.amount ?? 0;

  return { cashInClient, cashOutFixed, cashOutSalary, cashOutExpense };
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
  const company = (url.searchParams.get("company") ?? "boost") as Company;

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

  const records = await Promise.all(
    targetMonths.map(async (targetMonth) => {
      const [rec, auto] = await Promise.all([
        prisma.pLRecord.findFirst({
          where: { recordType: "cf", targetMonth, cfCompany: company },
        }),
        calcAutoFields(targetMonth, company),
      ]);

      const cashIn = auto.cashInClient + (rec?.cfCashInOther ?? 0);
      const cashOut = auto.cashOutSalary + auto.cashOutFixed + auto.cashOutExpense + (rec?.cfCashOutOther ?? 0);
      const openingBalance = rec?.cfBalancePrev ?? 0;
      const cfBalanceCurrent = openingBalance + cashIn - cashOut;

      return {
        month: targetMonth,
        company,
        openingBalance,
        cashInClient: auto.cashInClient,
        cashInOther: rec?.cfCashInOther ?? 0,
        cashOutSalary: auto.cashOutSalary,
        cashOutFixed: auto.cashOutFixed,
        cashOutExpense: auto.cashOutExpense,
        cashOutOther: rec?.cfCashOutOther ?? 0,
        cfBalanceCurrent,
      };
    })
  );

  return NextResponse.json(records.length === 1 ? records[0] : records);
}

// PUT /api/cashflow
// Body: { month, company, cashInOther, cashOutOther, openingBalance }
// ※ cashInClient / cashOutFixed / cashOutSalary は自動計算のため手動入力不可
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const { month, company = "boost", cashInOther, cashOutOther, openingBalance } = body ?? {};

  if (!month) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month は必須です" } },
      { status: 400 }
    );
  }

  const cfCompany = company as Company;
  const auto = await calcAutoFields(month, cfCompany);

  const inOther = cashInOther ?? 0;
  const outOther = cashOutOther ?? 0;
  const prevBalance = openingBalance ?? 0;

  const cashIn = auto.cashInClient + inOther;
  const cashOut = auto.cashOutSalary + auto.cashOutFixed + auto.cashOutExpense + outOther;
  const cfBalanceCurrent = prevBalance + cashIn - cashOut;

  const existing = await prisma.pLRecord.findFirst({
    where: { recordType: "cf", targetMonth: month, cfCompany },
  });

  let record;
  if (existing) {
    record = await prisma.pLRecord.update({
      where: { id: existing.id },
      data: {
        cfCashInClient: auto.cashInClient,
        cfCashInOther: inOther,
        cfCashOutSalary: auto.cashOutSalary,
        cfCashOutFixed: auto.cashOutFixed,
        cfCashOutOther: outOther,
        cfBalancePrev: prevBalance,
        cfBalanceCurrent,
      },
    });
  } else {
    record = await prisma.pLRecord.create({
      data: {
        recordType: "cf",
        cfCompany,
        targetMonth: month,
        cfCashInClient: auto.cashInClient,
        cfCashInOther: inOther,
        cfCashOutSalary: auto.cashOutSalary,
        cfCashOutFixed: auto.cashOutFixed,
        cfCashOutOther: outOther,
        cfBalancePrev: prevBalance,
        cfBalanceCurrent,
        createdBy: user.id,
      },
    });
  }

  return NextResponse.json({
    month: record.targetMonth,
    company: cfCompany,
    openingBalance: record.cfBalancePrev ?? 0,
    cashInClient: auto.cashInClient,
    cashInOther: record.cfCashInOther,
    cashOutSalary: auto.cashOutSalary,
    cashOutFixed: auto.cashOutFixed,
    cashOutExpense: auto.cashOutExpense,
    cashOutOther: record.cfCashOutOther,
    cfBalanceCurrent: record.cfBalanceCurrent,
  });
}
