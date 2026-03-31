export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { updateMonthlyHoursSchema } from "@/backend/validations/project";

type Params = { params: Promise<{ id: string; assignId: string }> };

// ─── PUT /api/projects/:id/assignments/:assignId/monthly ──
// 月別稼働時間を upsert
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { assignId } = await params;

  const assignment = await prisma.projectAssignment.findUnique({ where: { id: assignId } });
  if (!assignment) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "アサインが見つかりません" } }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateMonthlyHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { targetMonth, workloadHours } = parsed.data;

  const record = await prisma.projectAssignmentMonthly.upsert({
    where: { assignmentId_targetMonth: { assignmentId: assignId, targetMonth } },
    create: { assignmentId: assignId, targetMonth, workloadHours },
    update: { workloadHours },
  });

  return NextResponse.json({
    id: record.id,
    targetMonth: record.targetMonth,
    workloadHours: record.workloadHours,
  });
}
