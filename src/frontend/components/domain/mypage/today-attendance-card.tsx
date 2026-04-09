"use client";

import { memo } from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";

import type { TodayAttendance } from "@/shared/types/mypage";

export const TodayAttendanceCard = memo(function TodayAttendanceCard() {
  const { data: rawTodayAtt } = useSWR<TodayAttendance | { prevTodoTomorrow: string | null } | null>("/api/attendances/today");
  const todayAtt: TodayAttendance | null = rawTodayAtt && "breakMinutes" in rawTodayAtt ? rawTodayAtt : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>本日の勤怠</CardTitle>
      </CardHeader>
      {todayAtt ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400">出勤時刻</p>
            <p className="font-medium text-slate-800">{todayAtt.clockIn ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400">退勤時刻</p>
            <p className="font-medium text-slate-800">{todayAtt.clockOut ?? (todayAtt.status === "working" ? "勤務中" : "—")}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400">休憩</p>
            <p className="font-medium text-slate-800">{todayAtt.breakMinutes}分</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">本日の勤怠データがありません。</p>
      )}
    </Card>
  );
});
