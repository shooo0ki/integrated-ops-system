import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/members/:id/work-schedules?from=&to= ───────
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = await params;

  // 本人 or admin/manager のみ参照可
  if (user.memberId !== memberId && !["admin", "manager"].includes(user.role)) {
    return forbidden();
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const schedules = await prisma.workSchedule.findMany({
    where: {
      memberId,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    schedules.map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      isOff: s.isOff,
    }))
  );
}

// ─── POST /api/members/:id/work-schedules (bulk upsert) ──
// Body: [{ date, startTime, endTime, isOff }]
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = await params;

  // 本人 or admin/manager のみ登録可
  if (user.memberId !== memberId && !["admin", "manager"].includes(user.role)) {
    return forbidden();
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "配列形式で送信してください" } }, { status: 400 });
  }

  const results = await Promise.all(
    body.map(async (item: { date: string; startTime?: string; endTime?: string; isOff?: boolean }) => {
      if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
      return prisma.workSchedule.upsert({
        where: { memberId_date: { memberId, date: new Date(item.date) } },
        create: {
          memberId,
          date: new Date(item.date),
          startTime: item.isOff ? null : (item.startTime ?? null),
          endTime: item.isOff ? null : (item.endTime ?? null),
          isOff: item.isOff ?? false,
        },
        update: {
          startTime: item.isOff ? null : (item.startTime ?? null),
          endTime: item.isOff ? null : (item.endTime ?? null),
          isOff: item.isOff ?? false,
        },
      });
    })
  );

  return NextResponse.json({ saved: results.filter(Boolean).length });
}
