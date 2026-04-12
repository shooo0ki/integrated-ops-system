export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";

// GET /api/position-masters — ポジションマスタ一覧
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const masters = await prisma.projectPositionMaster.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(masters);
}

// POST /api/position-masters — ポジションマスタ追加
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name は必須です" } },
      { status: 400 },
    );
  }

  const existing = await prisma.projectPositionMaster.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "同名のポジションが既に存在します" } },
      { status: 409 },
    );
  }

  const created = await prisma.projectPositionMaster.create({ data: { name } });
  return NextResponse.json(created, { status: 201 });
}
