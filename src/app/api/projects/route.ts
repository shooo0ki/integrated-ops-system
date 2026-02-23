import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createProjectSchema } from "@/lib/validations/project";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// ─── GET /api/projects ────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") ?? "";
  const status = searchParams.get("status") ?? "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (company) where.company = company;
  if (status) where.status = status;

  const projects = await prisma.project.findMany({
    where,
    include: {
      assignments: {
        include: {
          member: { select: { id: true, name: true } },
          position: { select: { positionName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      company: p.company,
      startDate: p.startDate,
      endDate: p.endDate,
      clientName: p.clientName,
      contractType: p.contractType,
      monthlyContractAmount: p.monthlyContractAmount,
      assignments: p.assignments.map((a) => ({
        id: a.id,
        memberId: a.memberId,
        memberName: a.member.name,
        positionName: a.position.positionName,
        workloadHours: a.workloadHours,
      })),
    }))
  );
}

// ─── POST /api/projects ───────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { positions, endDate, ...projectData } = parsed.data;

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        ...projectData,
        startDate: new Date(projectData.startDate),
        endDate: endDate ? new Date(endDate) : null,
        monthlyContractAmount: projectData.monthlyContractAmount ?? 0,
        createdBy: user.id,
      },
    });

    if (positions && positions.length > 0) {
      await tx.projectPosition.createMany({
        data: positions.map((pos) => ({
          projectId: p.id,
          positionName: pos.positionName,
          requiredCount: pos.requiredCount ?? 1,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "projects",
        targetId: p.id,
        action: "CREATE",
        afterData: { name: p.name, status: p.status, company: p.company },
        ipAddress: "127.0.0.1",
      },
    });

    return p;
  });

  return NextResponse.json({ id: project.id, name: project.name, status: project.status }, { status: 201 });
}
