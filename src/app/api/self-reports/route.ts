import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { getSessionUser } from "@/backend/auth";

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
        select: {
          memberId: true,
          projectId: true,
          customLabel: true,
          reportedPercent: true,
          reportedHours: true,
          submittedAt: true,
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const reportsByMember = new Map<string, typeof reports>();
    for (const r of reports) {
      if (!reportsByMember.has(r.memberId)) reportsByMember.set(r.memberId, []);
      reportsByMember.get(r.memberId)!.push(r);
    }

    return NextResponse.json(
      allMembers.map((m) => {
        const memberReports = reportsByMember.get(m.id) ?? [];
        const totalPercent = memberReports.reduce((s, r) => s + r.reportedPercent, 0);
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
          totalPercent,
          submittedAt,
          projects: memberReports.map((r) => ({
            projectId: r.projectId,
            projectName: r.project?.name ?? null,
            customLabel: r.customLabel,
            reportedPercent: r.reportedPercent,
            reportedHours: r.reportedHours != null ? Number(r.reportedHours) : null,
          })),
        };
      }),
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  }

  // 一般ユーザー: 自分のみ
  const reports = await prisma.monthlySelfReport.findMany({
    where: { memberId: user.memberId, targetMonth: month },
    select: {
      id: true,
      projectId: true,
      customLabel: true,
      reportedPercent: true,
      reportedHours: true,
      submittedAt: true,
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    reports.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.project?.name ?? null,
      customLabel: r.customLabel,
      reportedPercent: r.reportedPercent,
      reportedHours: r.reportedHours != null ? Number(r.reportedHours) : null,
      submittedAt: r.submittedAt,
    })),
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
  );
}

// POST /api/self-reports
// Body: { targetMonth, allocations: [{ projectId?, customLabel?, reportedPercent }] }
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const { targetMonth, allocations } = body ?? {};

  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "targetMonth は YYYY-MM 形式で必須です" } },
      { status: 400 }
    );
  }
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "allocations は必須です" } },
      { status: 400 }
    );
  }

  // バリデーション
  const projectIds = new Set<string>();
  const customLabels = new Set<string>();
  let totalPercent = 0;

  for (const a of allocations as { projectId?: string; customLabel?: string; reportedPercent?: number }[]) {
    const hasProject = a.projectId != null && a.projectId !== "";
    const hasCustom = a.customLabel != null && a.customLabel.trim() !== "";
    if (!hasProject && !hasCustom) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "各行に projectId または customLabel が必要です" } },
        { status: 400 }
      );
    }
    if (hasProject && hasCustom) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "projectId と customLabel は同時指定できません" } },
        { status: 400 }
      );
    }
    if (hasProject) {
      if (projectIds.has(a.projectId!)) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "projectId が重複しています" } },
          { status: 400 }
        );
      }
      projectIds.add(a.projectId!);
    }
    if (hasCustom) {
      const label = a.customLabel!.trim();
      if (customLabels.has(label)) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "customLabel が重複しています" } },
          { status: 400 }
        );
      }
      customLabels.add(label);
    }
    const pct = a.reportedPercent ?? 0;
    if (pct < 0 || pct > 100) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "reportedPercent は 0〜100 の範囲で入力してください" } },
        { status: 400 }
      );
    }
    totalPercent += pct;
  }

  if (totalPercent !== 100) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: `配分の合計は100%にしてください（現在: ${totalPercent}%）` } },
      { status: 400 }
    );
  }

  // 勤怠データから実時間を計算
  const summary = await prisma.monthlyAttendanceSummary.findFirst({
    where: { memberId: user.memberId, targetMonth },
    select: { totalMinutes: true },
  });
  const totalHours = summary ? Number(summary.totalMinutes) / 60 : null;

  // トランザクションで delete + create
  await prisma.$transaction(async (tx) => {
    await tx.monthlySelfReport.deleteMany({
      where: { memberId: user.memberId, targetMonth },
    });
    await tx.monthlySelfReport.createMany({
      data: (allocations as { projectId?: string; customLabel?: string; reportedPercent: number }[]).map((a) => ({
        memberId: user.memberId,
        targetMonth,
        projectId: a.projectId || null,
        customLabel: a.customLabel?.trim() || null,
        reportedPercent: a.reportedPercent,
        reportedHours: totalHours != null
          ? Math.round(totalHours * (a.reportedPercent / 100) * 100) / 100
          : null,
        submittedAt: new Date(),
      })),
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
