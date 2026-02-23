"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Download, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── 型定義 ──────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  actualHours: number | null;
  status: string;
  confirmStatus: string;
  todoToday: string | null;
  doneToday: string | null;
  isModified: boolean;
}

interface MemberOption {
  id: string;
  name: string;
}

// ─── スタイル ────────────────────────────────────────────

const statusVariant: Record<string, "success" | "warning" | "default" | "danger"> = {
  working: "success", break: "warning", done: "default", not_started: "default", absent: "danger",
};
const STATUS_LABELS: Record<string, string> = {
  working: "出勤中", break: "休憩中", done: "退勤済", not_started: "未出勤", absent: "欠勤",
};

// ─── ページ ───────────────────────────────────────────────

export default function AttendanceListPage() {
  const { role, memberId: myMemberId } = useAuth();
  const isAdmin = role === "admin" || role === "manager";

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  // メンバー一覧（admin/manager 用）
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/members")
      .then((r) => r.json())
      .then((data: MemberOption[]) => setMembers(data))
      .catch(() => {});
  }, [isAdmin]);

  // memberId が確定したら記録取得
  const targetMemberId = isAdmin ? (selectedMemberId || myMemberId || "") : (myMemberId || "");

  const loadRecords = useCallback(async () => {
    if (!targetMemberId) return;
    setLoading(true);
    const params = new URLSearchParams({ memberId: targetMemberId, month });
    const res = await fetch(`/api/attendances?${params}`);
    if (res.ok) {
      setRecords(await res.json());
    }
    setLoading(false);
  }, [targetMemberId, month]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 集計
  const totalHours = records.reduce((s, r) => s + (r.actualHours ?? 0), 0);
  const workDays = records.filter((r) => r.status !== "not_started" && r.status !== "absent").length;
  const absentDays = records.filter((r) => r.status === "absent").length;

  async function handleApprove(id: string) {
    const res = await fetch(`/api/attendances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmStatus: "approved" }),
    });
    if (res.ok) {
      setApprovedIds((prev) => new Set(Array.from(prev).concat(id)));
    }
  }

  // 月オプション
  const monthOptions: string[] = [];
  const base = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    monthOptions.push(d.toISOString().slice(0, 7));
  }

  const targetMember = members.find((m) => m.id === targetMemberId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/attendance" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
          <ArrowLeft size={16} /> 打刻画面に戻る
        </Link>
        <h1 className="text-xl font-bold text-slate-800">勤怠一覧</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {isAdmin && (
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">自分</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">稼働日数</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{workDays}日</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">合計実働時間</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{totalHours.toFixed(1)}h</p>
        </Card>
        {absentDays > 0 && (
          <Card>
            <p className="text-xs text-slate-500">欠勤・休暇</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{absentDays}日</p>
          </Card>
        )}
      </div>

      {/* Daily table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <Card noPadding>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">
              {targetMember ? targetMember.name : "自分"} — {month.replace("-", "年")}月 勤怠詳細
            </span>
            <Button variant="outline" size="sm"><Download size={14} /> CSV出力</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-2.5 text-left font-medium">日付</th>
                  <th className="px-4 py-2.5 text-left font-medium">出勤</th>
                  <th className="px-4 py-2.5 text-left font-medium">退勤</th>
                  <th className="px-4 py-2.5 text-right font-medium">休憩</th>
                  <th className="px-4 py-2.5 text-right font-medium">実働</th>
                  <th className="px-4 py-2.5 text-left font-medium">状態</th>
                  <th className="px-4 py-2.5 text-left font-medium">今日やったこと</th>
                  {isAdmin && <th className="px-4 py-2.5 text-left font-medium">操作</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const approved = approvedIds.has(rec.id) || rec.confirmStatus === "approved";
                  const isToday = rec.date === new Date().toISOString().slice(0, 10);
                  return (
                    <tr
                      key={rec.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 ${rec.isModified ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-2 text-slate-700">
                        {rec.date.slice(5).replace("-", "/")}
                        {isToday && <span className="ml-1 text-xs text-blue-600">今日</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{rec.clockIn ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{rec.clockOut ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {rec.breakMinutes > 0 ? `${rec.breakMinutes}分` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">
                        {rec.actualHours != null ? `${rec.actualHours}h` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={statusVariant[rec.status] ?? "default"}>
                          {STATUS_LABELS[rec.status] ?? rec.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400 max-w-[200px] truncate">
                        {rec.doneToday ?? "—"}
                        {rec.isModified && <span className="ml-1 text-blue-500">（修正済）</span>}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2">
                          {approved ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle size={12} /> 承認済
                            </span>
                          ) : rec.status === "done" ? (
                            <button
                              onClick={() => handleApprove(rec.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              承認
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">該当する勤怠データがありません</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
