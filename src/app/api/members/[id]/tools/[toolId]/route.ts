export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { upsertToolSchema } from "@/backend/validations/member";


type Params = { params: Promise<{ id: string; toolId: string }> };

// ─── PUT /api/members/:id/tools/:toolId ───────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id, toolId } = await params;

  const tool = await prisma.memberTool.findFirst({ where: { id: toolId, memberId: id } });
  if (!tool) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "ツールが見つかりません" } },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = upsertToolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "入力値が不正です", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await prisma.memberTool.update({
    where: { id: toolId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/members/:id/tools/:toolId ────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id, toolId } = await params;

  const tool = await prisma.memberTool.findFirst({ where: { id: toolId, memberId: id } });
  if (!tool) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "ツールが見つかりません" } },
      { status: 404 }
    );
  }

  await prisma.memberTool.delete({ where: { id: toolId } });
  return NextResponse.json({ ok: true });
}
