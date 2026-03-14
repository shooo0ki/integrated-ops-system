"use client";

import { Clock, CheckCircle, Building2, Monitor, ClipboardEdit, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Badge } from "@/frontend/components/common/badge";
import { Button } from "@/frontend/components/common/button";
import { statusVariant, STATUS_LABELS } from "@/frontend/constants/attendance";
import { useAttendance } from "@/frontend/hooks/attendance/use-attendance";

export default function AttendancePage() {
  const {
    memberId, isAdmin,
    todayLabel,
    myRecord, myStatus, corrections,
    workLocation, setWorkLocation,
    todayPlan, setTodayPlan, todayDone, setTodayDone,
    tomorrowPlan, setTomorrowPlan, breakMinutes, setBreakMinutes,
    clockInError, clockingIn, clockingOut, actionLog,
    approvingId, corrToast,
    clockIn, clockOut, validateClockOut, handleApprove,
  } = useAttendance();

  return (
    <div className="space-y-6">
      {/* Toast */}
      {corrToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm text-white shadow-lg">
          <CheckCircle size={15} className="text-green-400" />
          {corrToast}
        </div>
      )}

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
              <Button
                variant="danger"
                size="lg"
                className="w-full"
                disabled={clockingOut}
                onClick={() => {
                  if (validateClockOut()) clockOut();
                }}
              >
                {clockingOut ? "送信中..." : "退勤する"}
              </Button>
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
              <div className="flex justify-center">
                <a href="/attendance/list" className="text-xs text-blue-600 hover:underline">勤怠一覧を見る →</a>
              </div>
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

      {/* 勤怠一覧・修正依頼リンク */}
      <a
        href="/attendance/list"
        className="flex max-w-lg items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardEdit size={16} className="text-slate-500" />
          <div>
            <p className="text-sm font-medium text-slate-700">勤怠一覧・修正依頼</p>
            <p className="text-xs text-slate-400">過去の打刻修正や新規申請はこちら</p>
          </div>
        </div>
        <ArrowRight size={14} className="text-slate-400" />
      </a>

      {/* 勤怠修正申請 承認セクション（admin/manager） */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>
              <ClipboardEdit size={16} className="inline mr-1" />
              勤怠修正申請の承認
            </CardTitle>
          </CardHeader>

          {corrections.length === 0 ? (
            <p className="text-sm text-slate-400">承認待ちの修正申請はありません。</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertCircle size={14} className="shrink-0" />
                {corrections.length}件 の修正申請が承認待ちです
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr className="text-xs text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">メンバー</th>
                      <th className="px-3 py-2 text-left font-medium">日付</th>
                      <th className="px-3 py-2 text-center font-medium">出勤</th>
                      <th className="px-3 py-2 text-center font-medium">退勤</th>
                      <th className="px-3 py-2 text-center font-medium">休憩</th>
                      <th className="px-3 py-2 text-right font-medium">実働</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {corrections.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{c.memberName}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {c.date.replace(/-/g, "/")}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">{c.clockIn ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{c.clockOut ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-500 text-xs">{c.breakMinutes}分</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {c.actualHours != null ? `${c.actualHours.toFixed(1)}h` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleApprove(c.id)}
                            disabled={approvingId === c.id}
                          >
                            <CheckCircle size={13} />
                            承認
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
