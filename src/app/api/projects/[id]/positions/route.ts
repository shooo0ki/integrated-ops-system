import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/:id/positions — ポジション新規作成
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
  if (!["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "プロジェクトが見つかりません" } }, { status: 404 });
  }

  const body = await req.json().catch(() => null) as { positionName?: string; requiredCount?: number } | null;
  if (!body?.positionName?.trim()) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "positionName は必須です" } }, { status: 400 });
  }

  const position = await prisma.projectPosition.create({
    data: {
      projectId,
      positionName: body.positionName.trim(),
      requiredCount: body.requiredCount ?? 1,
    },
  });

  return NextResponse.json(
    { id: position.id, positionName: position.positionName, requiredCount: position.requiredCount },
    { status: 201 }
  );
}
