export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";

type Params = { params: Promise<{ id: string }> };

// GET /api/members/:id/work-plans?weekStart=YYYY-MM-DD
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = await params;
  if (user.memberId !== memberId && !["admin", "manager"].includes(user.role)) {
    return forbidden();
  }

  const weekStart = new URL(req.url).searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "weekStart は YYYY-MM-DD 形式で指定してください" } },
      { status: 400 },
    );
  }

  const plans = await prisma.scheduleWorkPlan.findMany({
    where: { memberId, weekStart: new Date(weekStart) },
    select: { projectId: true, hours: true, note: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(plans);
}

// POST /api/members/:id/work-plans
// Body: { weekStart: "YYYY-MM-DD", plans: [{ projectId, hours, note? }] }
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: memberId } = await params;
  if (user.memberId !== memberId && !["admin", "manager"].includes(user.role)) {
    return forbidden();
  }

  const body = await req.json().catch(() => null);
  const weekStart: string = body?.weekStart;
  const plans: { projectId: string; hours: number; note?: string }[] = Array.isArray(body?.plans) ? body.plans : [];

  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "weekStart が不正です" } },
      { status: 400 },
    );
  }

  const weekStartDate = new Date(weekStart);

  // 既存を削除して再作成
  await prisma.scheduleWorkPlan.deleteMany({ where: { memberId, weekStart: weekStartDate } });

  const validPlans = plans.filter((p) => p.projectId && p.hours > 0);
  if (validPlans.length > 0) {
    await prisma.scheduleWorkPlan.createMany({
      data: validPlans.map((p) => ({
        memberId,
        weekStart: weekStartDate,
        projectId: p.projectId,
        hours: Math.round(p.hours * 2) / 2,
        note: p.note?.trim() || null,
      })),
    });
  }

  return NextResponse.json({ saved: validPlans.length });
}
