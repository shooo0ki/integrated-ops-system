import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string; assignId: string }> };

// ─── DELETE /api/projects/:id/assignments/:assignId ───────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { assignId } = await params;

  const assignment = await prisma.projectAssignment.findUnique({ where: { id: assignId } });
  if (!assignment) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "アサインが見つかりません" } }, { status: 404 });
  }

  await prisma.projectAssignment.delete({ where: { id: assignId } });

  return new NextResponse(null, { status: 204 });
}

// ─── PATCH /api/projects/:id/assignments/:assignId ────────
// workloadHours の更新
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { assignId } = await params;
  const body = await req.json().catch(() => null);
  const workloadHours = body?.workloadHours;

  if (typeof workloadHours !== "number" || workloadHours < 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "workloadHours が不正です" } },
      { status: 400 }
    );
  }

  const updated = await prisma.projectAssignment.update({
    where: { id: assignId },
    data: { workloadHours },
  });

  return NextResponse.json({ id: updated.id, workloadHours: updated.workloadHours });
}
