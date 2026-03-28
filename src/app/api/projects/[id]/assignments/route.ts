import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { createAssignmentSchema } from "@/backend/validations/project";


type Params = { params: Promise<{ id: string }> };

// ─── GET /api/projects/:id/assignments ────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: projectId } = await params;

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId },
    include: {
      member: { select: { id: true, name: true } },
      position: { select: { id: true, positionName: true } },
      monthlyHours: { orderBy: { targetMonth: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id: a.id,
      memberId: a.memberId,
      memberName: a.member?.name ?? null,
      positionId: a.positionId,
      positionName: a.position.positionName,
      workloadHours: a.workloadHours,
      startDate: a.startDate,
      endDate: a.endDate,
      monthlyHours: a.monthlyHours.map((mh) => ({
        id: mh.id,
        targetMonth: mh.targetMonth,
        workloadHours: mh.workloadHours,
      })),
    }))
  );
}

// ─── POST /api/projects/:id/assignments ───────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { endDate, ...data } = parsed.data;

  let assignment;
  try {
    assignment = await prisma.projectAssignment.create({
      data: {
        projectId,
        positionId: data.positionId,
        memberId: data.memberId ?? null,
        workloadHours: data.workloadHours,
        startDate: new Date(data.startDate),
        endDate: endDate ? new Date(endDate) : null,
        createdBy: user.id,
      },
      include: {
        member: { select: { id: true, name: true } },
        position: { select: { positionName: true } },
      },
    });
  } catch (e) {
    console.error("Assignment create error:", e);
    return NextResponse.json(
      { error: { code: "DB_ERROR", message: "登録に失敗しました。再ログイン後に再試行してください。" } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      id: assignment.id,
      memberId: assignment.memberId,
      memberName: assignment.member?.name ?? null,
      positionName: assignment.position.positionName,
      workloadHours: assignment.workloadHours,
      startDate: assignment.startDate,
    },
    { status: 201 }
  );
}
