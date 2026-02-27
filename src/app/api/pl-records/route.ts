import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/pl-records?month=YYYY-MM&projectId=xxx&months=YYYY-MM,YYYY-MM,...
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // 閲覧は全ロールに開放（編集は admin/manager のみ）

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const projectId = searchParams.get("projectId");
  const monthsParam = searchParams.get("months"); // comma-separated YYYY-MM

  // 複数月 (trendData 用)
  const targetMonths = monthsParam
    ? monthsParam.split(",").filter((m) => /^\d{4}-\d{2}$/.test(m))
    : month
    ? [month]
    : [];

  if (targetMonths.length === 0) {
    return NextResponse.json({ error: "month または months は必須です" }, { status: 400 });
  }

  const records = await prisma.pLRecord.findMany({
    where: {
      recordType: "pl",
      targetMonth: { in: targetMonths },
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: {
        select: { id: true, name: true, company: true, projectType: true, status: true, clientName: true },
      },
    },
    orderBy: [{ targetMonth: "asc" }, { project: { name: "asc" } }],
  });

  return NextResponse.json(
    records.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.project?.name ?? "—",
      projectType: r.project?.projectType ?? "salt2_own",
      company: r.project?.company ?? "salt2",
      projectStatus: r.project?.status ?? "active",
      clientName: r.project?.clientName ?? null,
      targetMonth: r.targetMonth,
      // 売上
      revenue: r.revenueContract + r.revenueExtra,
      revenueContract: r.revenueContract,
      revenueExtra: r.revenueExtra,
      // コスト
      laborCost: r.costLaborMonthly + r.costLaborHourly + r.costOutsourcing,
      costLaborMonthly: r.costLaborMonthly,
      costLaborHourly: r.costLaborHourly,
      costOutsourcing: r.costOutsourcing,
      toolCost: r.costTools,
      otherCost: r.costOther,
      // 損益
      grossProfit: r.grossProfit,
      grossMargin: r.grossProfitRate ? Number(r.grossProfitRate) : 0,
      markupRate: r.markupRate ? Number(r.markupRate) : null,
    }))
  );
}

// PUT /api/pl-records — admin / manager 手動入力・更新 (upsert)
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    projectId: string;
    targetMonth: string;
    revenueContract?: number;
    revenueExtra?: number;
    costLaborMonthly?: number;
    costLaborHourly?: number;
    costOutsourcing?: number;
    costTools?: number;
    costOther?: number;
    markupRate?: number;
    memo?: string;
  };

  const { projectId, targetMonth, ...rest } = body;
  if (!projectId || !targetMonth) {
    return NextResponse.json({ error: "projectId と targetMonth は必須です" }, { status: 400 });
  }

  // 粗利計算
  const revenueContract = rest.revenueContract ?? 0;
  const revenueExtra = rest.revenueExtra ?? 0;
  const revenue = revenueContract + revenueExtra;
  const costLaborMonthly = rest.costLaborMonthly ?? 0;
  const costLaborHourly = rest.costLaborHourly ?? 0;
  const costOutsourcing = rest.costOutsourcing ?? 0;
  const costTools = rest.costTools ?? 0;
  const costOther = rest.costOther ?? 0;
  const totalCost = costLaborMonthly + costLaborHourly + costOutsourcing + costTools + costOther;
  const grossProfit = revenue - totalCost;
  const grossProfitRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const record = await prisma.pLRecord.upsert({
    where: { projectId_targetMonth_recordType: { projectId, targetMonth, recordType: "pl" } },
    create: {
      recordType: "pl",
      projectId,
      targetMonth,
      revenueContract,
      revenueExtra,
      costLaborMonthly,
      costLaborHourly,
      costOutsourcing,
      costTools,
      costOther,
      grossProfit,
      grossProfitRate,
      markupRate: rest.markupRate ?? null,
      memo: rest.memo ?? null,
      createdBy: user.id,
    },
    update: {
      revenueContract,
      revenueExtra,
      costLaborMonthly,
      costLaborHourly,
      costOutsourcing,
      costTools,
      costOther,
      grossProfit,
      grossProfitRate,
      markupRate: rest.markupRate ?? null,
      memo: rest.memo ?? null,
    },
  });

  return NextResponse.json({ id: record.id, grossProfit, grossProfitRate });
}

// PATCH /api/pl-records — 掛け率・追加売上の部分更新（admin / manager）
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { id: string; markupRate?: number; revenueExtra?: number };
  if (!body.id) {
    return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  }

  const current = await prisma.pLRecord.findUnique({ where: { id: body.id } });
  if (!current) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const laborCost = current.costLaborMonthly + current.costLaborHourly + current.costOutsourcing;

  // 掛け率が指定された場合は revenueContract を再計算、なければ現状維持
  const newRevenueContract = typeof body.markupRate === "number"
    ? Math.round(laborCost * body.markupRate + current.costTools)
    : current.revenueContract;

  // 追加売上が指定された場合は更新、なければ現状維持
  const newRevenueExtra = typeof body.revenueExtra === "number" ? body.revenueExtra : current.revenueExtra;

  const newRevenue = newRevenueContract + newRevenueExtra;
  const grossProfit = newRevenue - laborCost - current.costTools - current.costOther;
  const grossProfitRate = newRevenue > 0 ? (grossProfit / newRevenue) * 100 : 0;

  const updated = await prisma.pLRecord.update({
    where: { id: body.id },
    data: {
      ...(typeof body.markupRate === "number" ? { markupRate: body.markupRate, revenueContract: newRevenueContract } : {}),
      revenueExtra: newRevenueExtra,
      grossProfit,
      grossProfitRate,
    },
  });

  return NextResponse.json({
    id: updated.id,
    markupRate: body.markupRate ?? (current.markupRate ? Number(current.markupRate) : null),
    revenueExtra: newRevenueExtra,
    revenue: newRevenue,
    grossProfit,
  });
}
