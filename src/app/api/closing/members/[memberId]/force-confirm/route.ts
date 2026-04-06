export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden, apiError } from "@/backend/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin" && user.role !== "manager") {
    return forbidden();
  }

  const { month } = await req.json() as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return apiError("VALIDATION_ERROR", "month は YYYY-MM 形式で指定してください", 400);
  }

  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);

  await prisma.attendance.updateMany({
    where: {
      memberId,
      date: { gte: monthStart, lte: monthEnd },
      confirmStatus: { not: "approved" },
    },
    data: { confirmStatus: "approved", slackNotified: true },
  });

  return NextResponse.json({ ok: true });
}
