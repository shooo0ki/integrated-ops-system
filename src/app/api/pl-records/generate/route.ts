import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/pl-records/generate
 * body: { targetMonth: "YYYY-MM" }
 *
 * MonthlySelfReport・Invoice・MemberTool の実データから
 * 各プロジェクトの PLRecord を自動生成（upsert）する。
 *
 * 計算ロジック:
 *   人件費  = Σ ( reportedHours × salaryAmount )          ← 時給制
 *             Σ ( reportedHours / 160 × salaryAmount )     ← 月給制
 *   ツール費 = Σ ( メンバー全ツール費 × プロジェクト時間 / 当月総時間 )
 *   売上
 *     salt2_own      : Project.monthlyContractAmount
 *     boost_dispatch : 人件費 × 掛け率(既存値 or 1.20) + ツール費
 *   粗利 = 売上 - 人件費 - ツール費 - その他コスト(既存値を保持)
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { targetMonth?: string };
  const { targetMonth } = body;

  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json({ error: "targetMonth は YYYY-MM 形式で必須です" }, { status: 400 });
  }

  // ── 1. 当月の自己申告を全件取得 ────────────────────────────
  const selfReports = await prisma.monthlySelfReport.findMany({
    where: { targetMonth },
    include: {
      member: {
        select: {
          id: true,
          salaryType: true,
          salaryAmount: true,
          tools: { select: { monthlyCost: true } },
        },
      },
    },
  });

  if (selfReports.length === 0) {
    return NextResponse.json({ message: "自己申告データがありません", generated: 0 });
  }

  // ── 2. メンバーごとの当月総申告時間を集計 ──────────────────
  const memberTotalHours = new Map<string, number>();
  for (const sr of selfReports) {
    const prev = memberTotalHours.get(sr.memberId) ?? 0;
    memberTotalHours.set(sr.memberId, prev + Number(sr.reportedHours));
  }

  // ── 3. プロジェクトごとに集計 ─────────────────────────────
  const projectMap = new Map<
    string,
    { laborCost: number; toolCost: number }
  >();

  for (const sr of selfReports) {
    const projId = sr.projectId;
    const hours = Number(sr.reportedHours);
    const { salaryType, salaryAmount, tools } = sr.member;
    const totalHours = memberTotalHours.get(sr.memberId) ?? 1;

    // 人件費
    // 時給制: 申告時間 × 時給
    // 月給制: 月給 × (当PJ申告時間 / 当月総申告時間)
    const laborCost =
      salaryType === "hourly"
        ? Math.round(hours * salaryAmount)
        : Math.round((hours / totalHours) * salaryAmount);

    // ツール費（プロジェクト時間比で按分）
    const memberToolTotal = tools.reduce((s, t) => s + t.monthlyCost, 0);
    const toolCost =
      totalHours > 0
        ? Math.round(memberToolTotal * (hours / totalHours))
        : 0;

    const prev = projectMap.get(projId) ?? { laborCost: 0, toolCost: 0 };
    projectMap.set(projId, {
      laborCost: prev.laborCost + laborCost,
      toolCost: prev.toolCost + toolCost,
    });
  }

  // ── 4. 対象プロジェクトを取得 ─────────────────────────────
  const projectIds = Array.from(projectMap.keys());
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds }, deletedAt: null },
    select: { id: true, projectType: true, monthlyContractAmount: true },
  });

  // ── 5. 既存 PLRecord を取得（掛け率・その他コストを保持するため） ──
  const existingRecords = await prisma.pLRecord.findMany({
    where: {
      recordType: "pl",
      projectId: { in: projectIds },
      targetMonth,
    },
    select: { projectId: true, markupRate: true, costOther: true },
  });
  const existingMap = new Map(
    existingRecords.map((r) => [r.projectId, r])
  );

  // ── 5b. 当月の経費明細をプロジェクトごとに集計 ──────────────
  const expenseItems = await prisma.invoiceItem.findMany({
    where: {
      taxable: false,
      linkedProjectId: { in: projectIds },
      invoice: { targetMonth },
    },
    select: { linkedProjectId: true, amount: true },
  });
  const expenseByProject = new Map<string, number>();
  for (const ei of expenseItems) {
    if (!ei.linkedProjectId) continue;
    expenseByProject.set(ei.linkedProjectId, (expenseByProject.get(ei.linkedProjectId) ?? 0) + ei.amount);
  }

  // ── 6. PLRecord を upsert ─────────────────────────────────
  const results: { projectId: string; grossProfit: number }[] = [];

  for (const project of projects) {
    const { laborCost, toolCost } = projectMap.get(project.id) ?? { laborCost: 0, toolCost: 0 };
    const existing = existingMap.get(project.id);

    // その他コスト: 経費（請求書から自動）+ 既存のその他コスト
    const expenseCost = expenseByProject.get(project.id) ?? 0;
    const costOther = expenseCost + (existing?.costOther ?? 0);

    // 掛け率: 既存値があればそれを優先
    // なければ損益分岐掛け率（差益≈0）を自動計算
    //   Revenue = labor × markup + tool
    //   Profit  = labor × (markup - 1) - otherCost = 0
    //   markup  = (labor + otherCost) / labor
    const breakevenMarkup = laborCost > 0 ? (laborCost + costOther) / laborCost : 1.0;
    const markupRate = existing?.markupRate ? Number(existing.markupRate) : breakevenMarkup;

    // 売上
    let revenue: number;
    if (project.projectType === "boost_dispatch") {
      revenue = Math.round(laborCost * markupRate + toolCost);
    } else {
      revenue = project.monthlyContractAmount;
    }

    const grossProfit = revenue - laborCost - toolCost - costOther;
    const grossProfitRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    await prisma.pLRecord.upsert({
      where: {
        projectId_targetMonth_recordType: {
          projectId: project.id,
          targetMonth,
          recordType: "pl",
        },
      },
      create: {
        recordType: "pl",
        projectId: project.id,
        targetMonth,
        revenueContract: revenue,
        revenueExtra: 0,
        costLaborMonthly: 0,
        costLaborHourly: laborCost,
        costOutsourcing: 0,
        costTools: toolCost,
        costOther,
        grossProfit,
        grossProfitRate,
        markupRate: project.projectType === "boost_dispatch" ? markupRate : null,
        createdBy: user.id,
      },
      update: {
        revenueContract: revenue,
        costLaborHourly: laborCost,
        costTools: toolCost,
        // costOther・markupRate は既存値を保持（手動調整を上書きしない）
        grossProfit,
        grossProfitRate,
      },
    });

    results.push({ projectId: project.id, grossProfit });
  }

  return NextResponse.json({
    message: `${results.length} 件の PL レコードを生成しました`,
    generated: results.length,
    targetMonth,
  });
}
