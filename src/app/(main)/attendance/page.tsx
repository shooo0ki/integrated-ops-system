"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Clock, CheckCircle, Coffee, Building2, Monitor } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── 型定義 ──────────────────────────────────────────────

type AttendanceStatus = "not_started" | "working" | "break" | "done" | "absent";

interface TodayRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  todoToday: string | null;
  doneToday: string | null;
  todoTomorrow: string | null;
  status: AttendanceStatus;
}

interface TeamRecord {
  id: string;
  memberId: string;
  memberName: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
}

// ─── スタイル ────────────────────────────────────────────

const statusVariant: Record<string, "success" | "warning" | "default" | "danger"> = {
  working: "success", break: "warning", done: "default", not_started: "default", absent: "danger",
};
const STATUS_LABELS: Record<string, string> = {
  working: "出勤中", break: "休憩中", done: "退勤済", not_started: "未出勤", absent: "欠勤",
};

// ─── ページ ───────────────────────────────────────────────

export default function AttendancePage() {
  const { memberId, role } = useAuth();
  const isAdmin = role === "admin" || role === "manager";

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayLabel = today.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const [myRecord, setMyRecord] = useState<TodayRecord | null>(null);
  const [myStatus, setMyStatus] = useState<AttendanceStatus>("not_started");
  const [teamRecords, setTeamRecords] = useState<TeamRecord[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // フォーム
  const [workLocation, setWorkLocation] = useState<"オフィス" | "オンライン" | "">("");
  const [todayPlan, setTodayPlan] = useState("");
  const [todayDone, setTodayDone] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [clockInError, setClockInError] = useState("");
  const [actionLog, setActionLog] = useState<string[]>([]);

  const timeStr = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  // 今日の自分の打刻記録を取得
  const loadToday = useCallback(async () => {
    const res = await fetch("/api/attendances/today");
    if (!res.ok) return;
    const data: TodayRecord | null = await res.json();
    if (data) {
      setMyRecord(data);
      setMyStatus(data.status);
      if (data.todoToday) setTodayPlan(data.todoToday);
    }
  }, []);

  // チームの今日の記録（admin/manager のみ）
  const loadTeam = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingTeam(true);
    const res = await fetch(`/api/attendances?month=${todayStr.slice(0, 7)}`);
    if (res.ok) {
      // 本来はチーム全員の今日分を取得するAPIが必要だが、
      // 簡易実装として自分の月次データから代用。チーム一覧は別途実装。
    }
    setLoadingTeam(false);
  }, [isAdmin, todayStr]);

  useEffect(() => {
    loadToday();
    if (isAdmin) loadTeam();
  }, [loadToday, loadTeam, isAdmin]);

  async function clockIn() {
    if (!workLocation) { setClockInError("勤務場所を選択してください"); return; }
    if (!todayPlan.trim()) { setClockInError("今日やることを入力してください"); return; }
    setClockInError("");
    const res = await fetch("/api/attendances/clock-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayStr, todoToday: todayPlan }),
    });
    if (res.ok) {
      setMyStatus("working");
      setActionLog((prev) => [`${timeStr()} 出勤しました（${workLocation}）`, ...prev]);
      await loadToday();
    }
  }

  function takeBreak() {
    setMyStatus("break");
    setActionLog((prev) => [`${timeStr()} 休憩開始`, ...prev]);
  }

  function endBreak() {
    setMyStatus("working");
    setActionLog((prev) => [`${timeStr()} 休憩終了`, ...prev]);
  }

  async function clockOut() {
    const res = await fetch("/api/attendances/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: todayStr,
        doneToday: todayDone,
        todoTomorrow: tomorrowPlan,
        breakMinutes: Number(breakMinutes),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const hours = data.workMinutes != null ? (data.workMinutes / 60).toFixed(1) : "—";
      setMyStatus("done");
      setActionLog((prev) => [`${timeStr()} 退勤しました（実働 ${hours}h）`, ...prev]);
      await loadToday();
    }
  }

  return (
    <div className="space-y-6">
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
                  {(["オフィス", "オンライン"] as const).map((loc) => (
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
              <Button variant="primary" size="lg" className="w-full" onClick={clockIn} disabled={!memberId}>
                <CheckCircle size={18} />
                出勤する
              </Button>
            </div>
          )}

          {/* 出勤中 */}
          {myStatus === "working" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" size="lg" onClick={takeBreak}>
                  <Coffee size={18} />
                  休憩する
                </Button>
                <Button variant="danger" size="lg" onClick={clockOut}>
                  退勤する
                </Button>
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
                <label className="text-sm font-medium text-slate-700">明日やること <span className="text-red-500">*</span></label>
                <textarea
                  value={tomorrowPlan}
                  onChange={(e) => setTomorrowPlan(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="明日のタスクを入力..."
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 休憩中 */}
          {myStatus === "break" && (
            <Button variant="primary" size="lg" className="w-full" onClick={endBreak}>
              <Clock size={18} />
              休憩終了
            </Button>
          )}

          {/* 退勤済み */}
          {myStatus === "done" && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-3 text-slate-500">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">本日の勤怠は完了しています</span>
              </div>
              {myRecord?.clockOut && (
                <p className="text-center text-xs text-slate-400">退勤: {myRecord.clockOut}</p>
              )}
              <div className="flex justify-center">
                <Link href="/attendance/list" className="text-xs text-blue-600 hover:underline">勤怠一覧を見る →</Link>
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

      {/* チームステータス（admin/manager） */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>チーム勤怠状況（本日）</CardTitle>
          </CardHeader>
          {loadingTeam ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : (
            <p className="text-sm text-slate-400">
              ※ チーム一覧は勤怠一覧ページで確認できます。
              <Link href="/attendance/list" className="ml-1 text-blue-600 hover:underline">勤怠一覧へ →</Link>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
