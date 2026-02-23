import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { updateProjectSchema } from "@/lib/validations/project";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}
function notFound() {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } }, { status: 404 });
}

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/projects/:id ────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      positions: {
        include: {
          assignments: { select: { id: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      assignments: {
        include: {
          member: { select: { id: true, name: true } },
          position: { select: { positionName: true } },
        },
      },
    },
  });

  if (!project) return notFound();

  return NextResponse.json({
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    company: project.company,
    projectType: project.projectType,
    startDate: project.startDate,
    endDate: project.endDate,
    clientName: project.clientName,
    contractType: project.contractType,
    monthlyContractAmount: project.monthlyContractAmount,
    positions: project.positions.map((pos) => ({
      id: pos.id,
      positionName: pos.positionName,
      requiredCount: pos.requiredCount,
      assignmentCount: pos.assignments.length,
    })),
    assignments: project.assignments.map((a) => ({
      id: a.id,
      memberId: a.memberId,
      memberName: a.member.name,
      positionName: a.position.positionName,
      positionId: a.positionId,
      workloadHours: a.workloadHours,
      startDate: a.startDate,
      endDate: a.endDate,
    })),
  });
}

// ─── PUT /api/projects/:id ────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { endDate, startDate, ...rest } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.project.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "projects",
        targetId: id,
        action: "UPDATE",
        beforeData: { name: project.name, status: project.status },
        afterData: { name: p.name, status: p.status },
        ipAddress: "127.0.0.1",
      },
    });

    return p;
  });

  return NextResponse.json({ id: updated.id, name: updated.name, status: updated.status });
}

// ─── DELETE /api/projects/:id ─────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!project) return notFound();

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "projects",
        targetId: id,
        action: "DELETE",
        beforeData: { name: project.name, status: project.status },
        ipAddress: "127.0.0.1",
      },
    });
  });

  return new NextResponse(null, { status: 204 });
}
