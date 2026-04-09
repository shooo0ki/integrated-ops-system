export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { sendSlack, getSlackMention } from "@/backend/slack";
import { syncSchedulesToCalendar } from "@/backend/google-calendar";
import { logger } from "@/backend/logger";


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
      locationType: s.locationType,
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
    body.map(async (item: { date: string; startTime?: string; endTime?: string; isOff?: boolean; locationType?: string }) => {
      if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return null;
      const locationType = item.locationType ?? "office";
      return prisma.workSchedule.upsert({
        where: { memberId_date: { memberId, date: new Date(item.date) } },
        create: {
          memberId,
          date: new Date(item.date),
          startTime: item.isOff ? null : (item.startTime ?? null),
          endTime: item.isOff ? null : (item.endTime ?? null),
          isOff: item.isOff ?? false,
          locationType,
        },
        update: {
          startTime: item.isOff ? null : (item.startTime ?? null),
          endTime: item.isOff ? null : (item.endTime ?? null),
          isOff: item.isOff ?? false,
          locationType,
        },
      });
    })
  );

  const saved = results.filter(Boolean);
  const WEEKDAYS_JA = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const LOCATION_JA: Record<string, string> = { office: "出社", remote: "リモート" };
  type ScheduleItem = { date: string; startTime?: string | null; endTime?: string | null; isOff?: boolean; locationType?: string };
  const workDays: ScheduleItem[] = (body as ScheduleItem[])
    .filter((item) => item.date && !item.isOff)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (saved.length > 0 && workDays.length > 0) {
    const firstDate = new Date(workDays[0].date);
    const dow = firstDate.getDay();
    const weekStart = new Date(firstDate);
    weekStart.setDate(weekStart.getDate() + (dow === 0 ? -6 : 1 - dow));
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const mention = await getSlackMention(user.email, user.name);
    const lines = [
      `${mention}  週間予定を受け付けました（週開始: ${weekStartStr}）\n`,
      ...workDays.map((item) => {
        const d = new Date(item.date);
        const dayName = WEEKDAYS_JA[d.getDay()];
        const time = item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : "終日";
        const loc = LOCATION_JA[item.locationType ?? "office"] ?? item.locationType ?? "";
        return `• ${dayName}: ${time} ${loc}`;
      }),
    ];
    await sendSlack(lines.join("\n"), "schedule");
  }

  // Google Calendar 同期
  const calItems = (body as ScheduleItem[])
    .filter((item) => item.date)
    .map((item) => ({
      date: item.date,
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      isOff: item.isOff ?? false,
      locationType: item.locationType ?? "office",
    }));

  let gcalError: string | null = null;
  try {
    await syncSchedulesToCalendar(memberId, calItems);
  } catch (err) {
    gcalError = "Google Calendar の同期に失敗しました";
    logger.error("work-schedules", "Google Calendar sync failed", err);
  }

  return NextResponse.json({ saved: saved.length, gcalError });
}
