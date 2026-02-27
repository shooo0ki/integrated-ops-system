import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}

// GET /api/self-reports?month=YYYY-MM
// admin/manager: 全メンバーの申告状況を返す（未申告メンバーも含む）
// その他: 自分のみ
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "month は YYYY-MM 形式で必須です" } },
      { status: 400 }
    );
  }

  const isAdminOrManager = user.role === "admin" || user.role === "manager";

  // 管理者/マネージャー: 全メンバーの申告状況（未申告含む）
  if (isAdminOrManager) {
    const [allMembers, reports] = await Promise.all([
      prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.monthlySelfReport.findMany({
        where: { targetMonth: month },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // メンバーごとに申告データをグルーピング
    const reportsByMember = new Map<string, typeof reports>();
    for (const r of reports) {
      if (!reportsByMember.has(r.memberId)) reportsByMember.set(r.memberId, []);
      reportsByMember.get(r.memberId)!.push(r);
    }

    return NextResponse.json(
      allMembers.map((m) => {
        const memberReports = reportsByMember.get(m.id) ?? [];
        const totalHours = memberReports.reduce((s, r) => s + Number(r.reportedHours), 0);
        const submitted = memberReports.length > 0;
        const submittedAt = submitted
          ? memberReports.reduce((latest, r) =>
              r.submittedAt && (!latest || r.submittedAt > latest) ? r.submittedAt : latest,
              null as Date | null
            )
          : null;
        return {
          memberId: m.id,
          memberName: m.name,
          submitted,
          totalHours,
          submittedAt,
          projects: memberReports.map((r) => ({
            projectId: r.projectId,
            projectName: r.project.name,
            reportedHours: Number(r.reportedHours),
          })),
        };
      })
    );
  }

  // 一般ユーザー: 自分のみ
  const reports = await prisma.monthlySelfReport.findMany({
    where: { memberId: user.memberId, targetMonth: month },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    reports.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.project.name,
      reportedHours: Number(r.reportedHours),
      submittedAt: r.submittedAt,
    }))
  );
}

// POST /api/self-reports
// Body: { targetMonth: string; allocations: { projectId: string; reportedHours: number }[] }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const { targetMonth, allocations } = body ?? {};

  if (!targetMonth || !Array.isArray(allocations)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "targetMonth, allocations は必須です" } },
      { status: 400 }
    );
  }

  await Promise.all(
    (allocations as { projectId: string; reportedHours: number }[]).map(({ projectId, reportedHours }) =>
      prisma.monthlySelfReport.upsert({
        where: {
          memberId_targetMonth_projectId: {
            memberId: user.memberId,
            targetMonth,
            projectId,
          },
        },
        create: {
          memberId: user.memberId,
          targetMonth,
          projectId,
          reportedHours,
          submittedAt: new Date(),
        },
        update: {
          reportedHours,
          submittedAt: new Date(),
        },
      })
    )
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
