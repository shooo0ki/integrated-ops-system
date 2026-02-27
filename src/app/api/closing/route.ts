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
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);

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

  // 月の全勤怠記録
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      memberId: { in: members.map((m) => m.id) },
    },
    select: {
      memberId: true,
      date: true,
      clockIn: true,
      clockOut: true,
      workMinutes: true,
      confirmStatus: true,
      slackNotified: true,
    },
  });

  // 月の全勤務予定（欠勤判定用）
  const schedules = await prisma.workSchedule.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      memberId: { in: members.map((m) => m.id) },
      isOff: false,
    },
    select: { memberId: true, date: true },
  });

  // 請求書情報
  const invoices = await prisma.invoice.findMany({
    where: {
      targetMonth: month,
      memberId: { in: members.map((m) => m.id) },
    },
    select: { memberId: true, amountExclTax: true, workHoursTotal: true, unitPrice: true, status: true, invoiceNumber: true },
  });

  const result = members.map((m) => {
    const atts = attendances.filter((a) => a.memberId === m.id);
    const scheds = schedules.filter((s) => s.memberId === m.id);

    // 稼働日数 = clockIn がある日数
    const workDays = atts.filter((a) => a.clockIn !== null).length;

    // 合計実働時間（分 → 時間）
    const totalMinutes = atts.reduce((s, a) => s + (a.workMinutes ?? 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // 未打刻日 = 勤務予定があるが勤怠なし or clockIn null の日
    const attDateSet = new Set(atts.filter((a) => a.clockIn).map((a) => a.date.toISOString().slice(0, 10)));
    const missingDays = scheds.filter((s) => !attDateSet.has(s.date.toISOString().slice(0, 10))).length;

    // 人件費見込み
    let estimatedAmount = 0;
    const inv = invoices.find((i) => i.memberId === m.id);
    if (inv) {
      estimatedAmount = inv.amountExclTax;
    } else if (m.salaryType === "hourly") {
      estimatedAmount = Math.round(totalHours * m.salaryAmount);
    } else {
      estimatedAmount = m.salaryAmount;
    }

    // 勤怠確認ステータス
    // slackNotified=false → "not_sent"
    // slackNotified=true, confirmStatus未確認 → "waiting"
    // 全員approved/confirmed → "confirmed"
    // slackNotified=true and forceApproved → "forced"
    const notifiedCount = atts.filter((a) => a.slackNotified).length;
    const confirmedCount = atts.filter((a) => a.confirmStatus === "approved" || a.confirmStatus === "confirmed").length;

    let confirmStatus: "not_sent" | "waiting" | "confirmed" | "forced";
    if (confirmedCount >= workDays && workDays > 0) {
      // 全て確認済み（slackNotifiedがなければforced判定はできないので簡易にconfirmed）
      confirmStatus = notifiedCount > 0 ? "confirmed" : "confirmed";
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
