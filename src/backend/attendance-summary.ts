import { prisma } from "@/backend/db";

/**
 * 勤怠書き込み後に月次サマリーを再集計して upsert する。
 * closing / notify はこのサマリーを読む（全行 scan 不要）。
 */
export async function recalcAttendanceSummary(
  memberId: string,
  targetMonth: string // "YYYY-MM"
): Promise<void> {
  const [year, mon] = targetMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

  const agg = await prisma.attendance.aggregate({
    where: { memberId, date: { gte: monthStart, lte: monthEnd } },
    _count: { clockIn: true },   // 非null clockIn の件数 = 稼働日数
    _sum: { workMinutes: true },
  });

  await prisma.monthlyAttendanceSummary.upsert({
    where: { memberId_targetMonth: { memberId, targetMonth } },
    create: {
      memberId,
      targetMonth,
      workDays: agg._count.clockIn,
      totalMinutes: agg._sum.workMinutes ?? 0,
    },
    update: {
      workDays: agg._count.clockIn,
      totalMinutes: agg._sum.workMinutes ?? 0,
    },
  });
}

/** Date または "YYYY-MM-DD" 文字列から "YYYY-MM" を返す */
export function toTargetMonth(date: Date | string): string {
  const s = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  return s.slice(0, 7);
}
