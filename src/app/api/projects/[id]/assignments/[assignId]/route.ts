export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { swapMemberSchema } from "@/backend/validations/project";


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

  return NextResponse.json({ ok: true });
}

// ─── PATCH /api/projects/:id/assignments/:assignId ────────
// workloadHours / memberId の更新
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { assignId } = await params;
  const body = await req.json().catch(() => null);

  // メンバー差替え
  if (body && "memberId" in body) {
    const parsed = swapMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "memberId が不正です" } },
        { status: 400 }
      );
    }
    const updated = await prisma.projectAssignment.update({
      where: { id: assignId },
      data: { memberId: parsed.data.memberId },
      include: { member: { select: { id: true, name: true } } },
    });
    return NextResponse.json({
      id: updated.id,
      memberId: updated.memberId,
      memberName: updated.member?.name ?? null,
      workloadHours: updated.workloadHours,
    });
  }

  // デフォルト workloadHours 更新
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
