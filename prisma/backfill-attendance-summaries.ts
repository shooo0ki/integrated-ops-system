/**
 * 既存の attendance レコードから monthly_attendance_summaries を再集計するバックフィルスクリプト。
 * 実行: npx ts-node --project tsconfig.seed.json prisma/backfill-attendance-summaries.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // clockIn がある attendance から (memberId, targetMonth) の組み合わせを収集
  const rows = await prisma.attendance.findMany({
    select: { memberId: true, date: true },
    where: { clockIn: { not: null } },
  });

  // (memberId, targetMonth) の重複排除
  const pairSet = new Set<string>();
  for (const r of rows) {
    const targetMonth = r.date.toISOString().slice(0, 7);
    pairSet.add(`${r.memberId}:::${targetMonth}`);
  }
  const pairs = Array.from(pairSet).map((s) => {
    const [memberId, targetMonth] = s.split(":::");
    return { memberId, targetMonth };
  });

  console.log(`Backfilling ${pairs.length} (memberId, month) pairs...`);

  for (const { memberId, targetMonth } of pairs) {
    const [year, mon] = targetMonth.split("-").map(Number);
      const monthStart = new Date(Date.UTC(year, mon - 1, 1));
      const monthEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

      const agg = await prisma.attendance.aggregate({
        where: { memberId, date: { gte: monthStart, lte: monthEnd } },
        _count: { clockIn: true },
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

    console.log(`  ${memberId} ${targetMonth}: ${agg._count.clockIn}日 ${agg._sum.workMinutes ?? 0}分`);
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
