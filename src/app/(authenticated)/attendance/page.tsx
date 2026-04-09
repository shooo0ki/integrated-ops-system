"use client";

import { Clock, CheckCircle, Building2, Monitor } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Badge } from "@/frontend/components/common/badge";
import { Button } from "@/frontend/components/common/button";
import { Toast } from "@/frontend/components/common/toast";
import { statusVariant, STATUS_LABELS } from "@/frontend/constants/attendance";
import { useAttendance } from "@/frontend/hooks/attendance/use-attendance";

export default function AttendancePage() {
  const {
    memberId,
    todayLabel,
    myRecord, myStatus,
    workLocation, setWorkLocation,
    todayPlan, setTodayPlan, todayDone, setTodayDone,
    tomorrowPlan, setTomorrowPlan, breakMinutes, setBreakMinutes,
    clockInError, clockingIn, clockingOut, actionLog,
    toast,
    clockIn, clockOut, validateClockOut,
  } = useAttendance();

  return (
    <div className="space-y-6">
      <Toast message={toast.message} />

      <div>
        <h1 className="text-xl font-bold text-slate-800">打刻</h1>
        <p className="text-sm text-slate-500">{todayLabel}</p>
      </div>

      {/* My Clock Card */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>今日の勤怠</CardTitle>
          <Clock size={16} className="text-slate-400" />
        </CardHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">現在のステータス</span>
            <div className="flex items-center gap-2">
              {myRecord?.clockIn && <span className="text-xs text-slate-500">出勤: {myRecord.clockIn}</span>}
              <Badge variant={statusVariant[myStatus] ?? "default"} className="text-sm px-3 py-1">
                {STATUS_LABELS[myStatus] ?? myStatus}
              </Badge>
            </div>
          </div>

          {/* 出勤前 */}
          {myStatus === "not_started" && (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">勤務場所 <span className="text-red-500">*</span></p>
                <div className="flex gap-2">
                  {(["オフィス", "オンライン"] as const).map((loc: "オフィス" | "オンライン") => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setWorkLocation(loc)}
                      className={`flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                        workLocation === loc
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {loc === "オフィス" ? <Building2 size={15} /> : <Monitor size={15} />}
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">今日やること <span className="text-red-500">*</span></label>
                <textarea
                  value={todayPlan}
                  onChange={(e) => setTodayPlan(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="本日のタスクを入力..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {clockInError && <p className="text-xs text-red-600">{clockInError}</p>}
              <Button variant="primary" size="lg" className="w-full" onClick={clockIn} disabled={!memberId || clockingIn}>
                <CheckCircle size={18} />
                {clockingIn ? "送信中..." : "出勤する"}
              </Button>
            </div>
          )}

          {/* 出勤中 */}
          {myStatus === "working" && (
            <div className="space-y-3">
              {myRecord?.todoToday && (
                <div className="rounded-md bg-blue-50 px-3 py-2">
                  <p className="text-xs font-medium text-blue-600 mb-1">今日の予定（出勤時に入力）</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{myRecord.todoToday}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700">今日やったこと <span className="text-red-500">*</span></label>
                <textarea
                  value={todayDone}
                  onChange={(e) => setTodayDone(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="本日の実績を入力..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">次回勤務日にやること <span className="text-red-500">*</span></label>
                <textarea
                  value={tomorrowPlan}
                  onChange={(e) => setTomorrowPlan(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="次回勤務日のタスクを入力..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">休憩時間（分）</label>
                <input
                  type="number"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  min={0}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {clockInError && <p className="text-xs text-red-600">{clockInError}</p>}
              <button
                className="w-full inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-medium bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={clockingOut}
                onClick={() => {
                  if (validateClockOut()) clockOut();
                }}
              >
                {clockingOut ? "送信中..." : "退勤する"}
              </button>
            </div>
          )}

          {/* 退勤済み */}
          {myStatus === "done" && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 py-3 text-green-700">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">お疲れ様でした！</span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">出勤</span>
                  <span className="font-medium text-slate-700">{myRecord?.clockIn ?? "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">退勤</span>
                  <span className="font-medium text-slate-700">{myRecord?.clockOut ?? "—"}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                  <span className="text-slate-500">実働時間</span>
                  <span className="font-bold text-slate-800">
                    {myRecord?.actualHours != null ? `${myRecord.actualHours.toFixed(1)}h` : "—"}
                  </span>
                </div>
              </div>
              {myRecord?.doneToday && (
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500 mb-1">今日やったこと</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{myRecord.doneToday}</p>
                </div>
              )}
              {myRecord?.todoTomorrow && (
                <div className="rounded-md bg-blue-50 px-3 py-2">
                  <p className="text-xs font-medium text-blue-600 mb-1">次回勤務日の予定</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{myRecord.todoTomorrow}</p>
                </div>
              )}
            </div>
          )}

          {/* Action log */}
          {actionLog.length > 0 && (
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="mb-1 text-xs font-medium text-slate-500">打刻ログ</p>
              {actionLog.map((log, i) => (
                <p key={i} className="text-xs text-slate-600">{log}</p>
              ))}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
