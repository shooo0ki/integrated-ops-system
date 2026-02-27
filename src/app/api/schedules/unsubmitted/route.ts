import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// 翌週の月曜〜日曜を返す
function getNextWeekRange(): { from: Date; to: Date; fromStr: string; toStr: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun
  const daysToNextMon = dow === 0 ? 1 : 8 - dow;

  const from = new Date(today);
  from.setDate(today.getDate() + daysToNextMon);

  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from, to, fromStr: fmt(from), toStr: fmt(to) };
}

// GET /api/schedules/unsubmitted
// 翌週（月〜日）に勤務予定を1件も登録していないアクティブメンバーを返す
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { from, to, fromStr, toStr } = getNextWeekRange();

  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 翌週に1件でもスケジュールを持つメンバーのID
  const submitted = await prisma.workSchedule.findMany({
    where: {
      date: { gte: from, lte: to },
      memberId: { in: members.map((m) => m.id) },
    },
    select: { memberId: true },
    distinct: ["memberId"],
  });

  const submittedIds = new Set(submitted.map((s) => s.memberId));
  const unsubmitted = members.filter((m) => !submittedIds.has(m.id));

  return NextResponse.json({
    from: fromStr,
    to: toStr,
    total: members.length,
    unsubmitted: unsubmitted.map((m) => ({ memberId: m.id, memberName: m.name })),
  });
}
