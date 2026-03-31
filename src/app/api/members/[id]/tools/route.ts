export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { upsertToolSchema } from "@/backend/validations/member";


type Params = { params: Promise<{ id: string }> };

// ─── GET /api/members/:id/tools ───────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const tools = await prisma.memberTool.findMany({
    where: { memberId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(tools);
}

// ─── POST /api/members/:id/tools ──────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id } = await params;

  const member = await prisma.member.findFirst({ where: { id, deletedAt: null } });
  if (!member) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
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

  const tool = await prisma.memberTool.create({
    data: { memberId: id, companyLabel: "salt2", ...parsed.data },
  });

  return NextResponse.json(tool, { status: 201 });
}
