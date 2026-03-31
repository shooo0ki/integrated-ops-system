export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { type ConfirmStatus } from "@prisma/client";
import { prisma } from "@/backend/db";
import { unauthorized, forbidden } from "@/backend/api-response";
import { getSessionUser } from "@/backend/auth";
import { recalcAttendanceSummary } from "@/backend/attendance-summary";


type Params = { params: Promise<{ id: string }> };

// ─── PATCH /api/attendances/:id ───────────────────────────
// admin/manager: confirmStatus の更新（confirmed / approved）
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!["admin", "manager"].includes(user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const confirmStatusRaw: string = body?.confirmStatus;

  if (!["unconfirmed", "confirmed", "approved", "rejected"].includes(confirmStatusRaw)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "confirmStatus が不正です" } },
      { status: 400 }
    );
  }

  const confirmStatus = confirmStatusRaw as ConfirmStatus;

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

// ─── PUT /api/attendances/:id ────────────────────────────
// 本人: 自分の勤怠を修正申請（status='modified', confirmStatus='unconfirmed'）
// admin/manager: 任意メンバーの勤怠を直接修正
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const attendance = await prisma.attendance.findUnique({ where: { id } });
  if (!attendance) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "勤怠記録が見つかりません" } }, { status: 404 });
  }

  // 権限チェック: 自分のデータ or admin/manager
  const isAdminOrManager = ["admin", "manager"].includes(user.role);
  if (!isAdminOrManager && attendance.memberId !== user.memberId) return forbidden();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "リクエストボディが不正です" } }, { status: 400 });
  }

  // "HH:MM"（JST）を attendance.date ベースの UTC Date に変換
  function parseTimeOnDate(baseDate: Date, timeStr: string | null): Date | null {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
    const [h, m] = timeStr.split(":").map(Number);
    // baseDate は UTC midnight。JST midnight = baseDate - 9h
    // ユーザー入力 h:m は JST なので UTC に変換: jstMidnight + h:m
    const jstMidnightMs = baseDate.getTime() - 9 * 60 * 60 * 1000;
    return new Date(jstMidnightMs + h * 60 * 60 * 1000 + m * 60 * 1000);
  }

  const newClockIn = body.clockIn !== undefined
    ? parseTimeOnDate(attendance.date, body.clockIn)
    : undefined;
  const newClockOut = body.clockOut !== undefined
    ? parseTimeOnDate(attendance.date, body.clockOut)
    : undefined;
  const newBreakMinutes = body.breakMinutes !== undefined ? Number(body.breakMinutes) : undefined;

  // 日またぎ対応: clockOut が clockIn より前なら翌日扱い（例: 出勤22:00 → 退勤04:00）
  const effectiveClockIn = newClockIn !== undefined ? newClockIn : attendance.clockIn;
  let adjustedClockOut = newClockOut !== undefined ? newClockOut : attendance.clockOut;
  if (effectiveClockIn && adjustedClockOut && adjustedClockOut <= effectiveClockIn) {
    adjustedClockOut = new Date(adjustedClockOut.getTime() + 24 * 60 * 60 * 1000);
  }
  const effectiveClockOut = adjustedClockOut;
  const effectiveBreak = newBreakMinutes !== undefined ? newBreakMinutes : attendance.breakMinutes;

  let newWorkMinutes: number | undefined;
  if (effectiveClockIn && effectiveClockOut) {
    const mins = Math.round(
      (effectiveClockOut.getTime() - effectiveClockIn.getTime()) / 60000
    ) - effectiveBreak;
    newWorkMinutes = Math.max(0, mins);
  }

  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      ...(newClockIn !== undefined ? { clockIn: newClockIn } : {}),
      ...(newClockOut !== undefined ? { clockOut: adjustedClockOut } : {}),
      ...(newBreakMinutes !== undefined ? { breakMinutes: newBreakMinutes } : {}),
      ...(newWorkMinutes !== undefined ? { workMinutes: newWorkMinutes } : {}),
      status: "modified",
      confirmStatus: "unconfirmed",
    },
  });

  await recalcAttendanceSummary(updated.memberId, updated.date.toISOString().slice(0, 7));

  function toTimeStr(dt: Date | null): string | null {
    if (!dt) return null;
    const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
  }

  const actualHours = updated.workMinutes != null
    ? Math.round((updated.workMinutes / 60) * 10) / 10
    : null;

  return NextResponse.json({
    id: updated.id,
    date: updated.date.toISOString().slice(0, 10),
    clockIn: toTimeStr(updated.clockIn),
    clockOut: toTimeStr(updated.clockOut),
    breakMinutes: updated.breakMinutes,
    actualHours,
    status: "modified",
    confirmStatus: updated.confirmStatus,
    isModified: true,
  });
}
