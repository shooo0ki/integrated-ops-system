import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

type Params = { params: Promise<{ id: string }> };

// ─── PATCH /api/attendances/:id ───────────────────────────
// admin/manager: confirmStatus の更新（confirmed / approved）
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const confirmStatus: string = body?.confirmStatus;

  if (!["unconfirmed", "confirmed", "approved"].includes(confirmStatus)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "confirmStatus が不正です" } },
      { status: 400 }
    );
  }

  const attendance = await prisma.attendance.findUnique({ where: { id } });
  if (!attendance) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "勤怠記録が見つかりません" } }, { status: 404 });
  }

  const updated = await prisma.attendance.update({
    where: { id },
    data: { confirmStatus },
  });

  return NextResponse.json({ id: updated.id, confirmStatus: updated.confirmStatus });
}
