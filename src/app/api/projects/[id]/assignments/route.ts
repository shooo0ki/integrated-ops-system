import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createAssignmentSchema } from "@/lib/validations/project";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/projects/:id/assignments ────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id: projectId } = await params;

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId },
    include: {
      member: { select: { id: true, name: true, company: true } },
      position: { select: { id: true, positionName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      id: a.id,
      memberId: a.memberId,
      memberName: a.member.name,
      memberCompany: a.member.company,
      positionId: a.positionId,
      positionName: a.position.positionName,
      workloadHours: a.workloadHours,
      startDate: a.startDate,
      endDate: a.endDate,
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

  const assignment = await prisma.projectAssignment.create({
    data: {
      projectId,
      positionId: data.positionId,
      memberId: data.memberId,
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

  return NextResponse.json(
    {
      id: assignment.id,
      memberId: assignment.memberId,
      memberName: assignment.member.name,
      positionName: assignment.position.positionName,
      workloadHours: assignment.workloadHours,
      startDate: assignment.startDate,
    },
    { status: 201 }
  );
}
