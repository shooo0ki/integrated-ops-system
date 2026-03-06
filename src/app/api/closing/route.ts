import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = user.role === "admin" || user.role === "manager";

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month は YYYY-MM 形式で指定してください" }, { status: 400 });
  }

  // 月の開始・終了
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

  // 対象メンバー：admin/manager は全員、それ以外は自分のみ
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      ...(!isAdmin && { id: user.memberId }),
    },
    select: {
      id: true,
      name: true,
      salaryType: true,
      salaryAmount: true,
      status: true,
    },
    orderBy: { name: "asc" },
  });

  const memberIds = members.map((m) => m.id);

  // 月次サマリー・Slack通知数・承認数・勤務予定数・請求書を並列取得
  // attendance の全行 scan を排除し、集計済みデータのみ取得する
  const [summaries, notifiedStats, confirmedStats, scheduleCounts, invoices] = await Promise.all([
    // MonthlyAttendanceSummary: workDays + totalMinutes（書き込み時に更新済み）
    prisma.monthlyAttendanceSummary.findMany({
      where: { targetMonth: month, memberId: { in: memberIds } },
      select: { memberId: true, workDays: true, totalMinutes: true },
    }),
    // slackNotified 件数
    prisma.attendance.groupBy({
      by: ["memberId"],
      where: {
        date: { gte: monthStart, lte: monthEnd },
        memberId: { in: memberIds },
        slackNotified: true,
      },
      _count: { id: true },
    }),
    // 確認済み件数（approved or confirmed）
    prisma.attendance.groupBy({
      by: ["memberId"],
      where: {
        date: { gte: monthStart, lte: monthEnd },
        memberId: { in: memberIds },
        confirmStatus: { in: ["approved", "confirmed"] },
      },
      _count: { id: true },
    }),
    // 勤務予定の稼働日数（isOff=false の件数）— missingDays 計算用
    prisma.workSchedule.groupBy({
      by: ["memberId"],
      where: {
        date: { gte: monthStart, lte: monthEnd },
        memberId: { in: memberIds },
        isOff: false,
      },
      _count: { id: true },
    }),
    // 請求書
    prisma.invoice.findMany({
      where: { targetMonth: month, memberId: { in: memberIds } },
      select: { memberId: true, amountExclTax: true, workHoursTotal: true, unitPrice: true, status: true, invoiceNumber: true },
    }),
  ]);

  // Map 化
  const summaryMap = new Map(summaries.map((s) => [s.memberId, s]));
  const notifiedMap = new Map(notifiedStats.map((s) => [s.memberId, s._count.id]));
  const confirmedMap = new Map(confirmedStats.map((s) => [s.memberId, s._count.id]));
  const scheduleCountMap = new Map(scheduleCounts.map((s) => [s.memberId, s._count.id]));
  const invoiceByMember = new Map(invoices.map((inv) => [inv.memberId, inv]));

  const result = members.map((m) => {
    const summary = summaryMap.get(m.id);
    const workDays = summary?.workDays ?? 0;
    const totalMinutes = summary?.totalMinutes ?? 0;
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // 未打刻日 = 勤務予定稼働日数 - 実際の clockIn 日数
    const scheduledDays = scheduleCountMap.get(m.id) ?? 0;
    const missingDays = Math.max(0, scheduledDays - workDays);

    const notifiedCount = notifiedMap.get(m.id) ?? 0;
    const confirmedCount = confirmedMap.get(m.id) ?? 0;

    // 人件費見込み
    const inv = invoiceByMember.get(m.id);
    let estimatedAmount = 0;
    if (inv) {
      estimatedAmount = inv.amountExclTax;
    } else if (m.salaryType === "hourly") {
      estimatedAmount = Math.round(totalHours * m.salaryAmount);
    } else {
      estimatedAmount = m.salaryAmount;
    }

    // 勤怠確認ステータス
    let confirmStatus: "not_sent" | "waiting" | "confirmed" | "forced";
    if (confirmedCount >= workDays && workDays > 0) {
      confirmStatus = "confirmed";
    } else if (notifiedCount > 0) {
      confirmStatus = "waiting";
    } else {
      confirmStatus = "not_sent";
    }

    // 請求書ステータス
    let invoiceStatus: "none" | "generated" | "sent" | "approved" | "accounting_sent" = "none";
    if (inv) {
      if (inv.status === "confirmed") invoiceStatus = "accounting_sent";
      else if (inv.status === "sent") invoiceStatus = "sent";
      else invoiceStatus = "generated";
    }

    return {
      memberId: m.id,
      memberName: m.name,
      salaryType: m.salaryType,
      salaryAmount: m.salaryAmount,
      contractType: m.salaryType === "hourly" ? "時給制" : "月給制",
      workDays,
      totalHours,
      missingDays,
      estimatedAmount,
      confirmStatus,
      invoiceStatus,
      hourlyRate: m.salaryType === "hourly" ? m.salaryAmount : null,
    };
  });

  return NextResponse.json(result);
}
