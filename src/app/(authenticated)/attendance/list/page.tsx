"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "@/frontend/components/common/prefetch-link";
import { ArrowLeft, Download, CheckCircle, XCircle, Plus, Pencil } from "lucide-react";
import { useAuth } from "@/frontend/contexts/auth-context";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Badge } from "@/frontend/components/common/badge";
import { Button } from "@/frontend/components/common/button";

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
  working: "success", break: "warning", done: "default", not_started: "default", absent: "danger", pending_approval: "warning",
};
const STATUS_LABELS: Record<string, string> = {
  working: "出勤中", break: "休憩中", done: "退勤済", not_started: "未出勤", absent: "欠勤", pending_approval: "承認待ち",
};

// ─── ページ ───────────────────────────────────────────────

export default function AttendanceListPage() {
  const { role, memberId: myMemberId } = useAuth();
  const isAdmin = role === "admin" || role === "manager";

  const { data: membersData = [] } = useSWR<MemberOption[]>(isAdmin ? "/api/members" : null);
  const members: MemberOption[] = Array.isArray(membersData) ? membersData : [];
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [month, setMonth] = useState("");
  const [jstToday, setJstToday] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(currentMonth);
    setJstToday(now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }));
    const opts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    setMonthOptions(opts);
  }, []);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  // 打刻申請フォーム
  const [newForm, setNewForm] = useState<{ open: boolean; date: string; clockIn: string; clockOut: string; breakMinutes: string; submitting: boolean; error: string }>({
    open: false, date: "", clockIn: "", clockOut: "", breakMinutes: "0", submitting: false, error: "",
  });

  // memberId が確定したら記録取得
  const targetMemberId = isAdmin ? (selectedMemberId || myMemberId || "") : (myMemberId || "");

  const { data: records = [], isLoading: loading, mutate: mutateRecords } = useSWR<AttendanceRecord[]>(
    targetMemberId && month ? `/api/attendances?memberId=${targetMemberId}&month=${month}` : null
  );

  // 集計（承認待ちは集計に含めない）
  const approvedRecords = records.filter((r) => r.status !== "pending_approval");
  const totalHours = approvedRecords.reduce((s, r) => s + (r.actualHours ?? 0), 0);
  const workDays = approvedRecords.filter((r) => r.status !== "not_started" && r.status !== "absent").length;
  const absentDays = records.filter((r) => r.status === "absent").length;
  const visibleRecords = records.slice(0, visibleCount);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/attendances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmStatus: "approved" }),
    });
    if (res.ok) {
      setApprovedIds((prev) => new Set(Array.from(prev).concat(id)));
      setRejectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      await mutateRecords();
    }
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/attendances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmStatus: "rejected" }),
    });
    if (res.ok) {
      setRejectedIds((prev) => new Set(Array.from(prev).concat(id)));
      setApprovedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      await mutateRecords();
    }
  }

  // 行編集
  const [editForm, setEditForm] = useState<{
    id: string; clockIn: string; clockOut: string; breakMinutes: string; submitting: boolean; error: string;
  } | null>(null);

  function startEdit(rec: AttendanceRecord) {
    setEditForm({
      id: rec.id,
      clockIn: rec.clockIn ?? "",
      clockOut: rec.clockOut ?? "",
      breakMinutes: String(rec.breakMinutes),
      submitting: false,
      error: "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditForm((f) => f && { ...f, submitting: true, error: "" });
    const res = await fetch(`/api/attendances/${editForm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clockIn: editForm.clockIn || null,
        clockOut: editForm.clockOut || null,
        breakMinutes: Number(editForm.breakMinutes),
      }),
    });
    if (res.ok) {
      setEditForm(null);
      await mutateRecords();
    } else {
      const data = await res.json().catch(() => ({}));
      setEditForm((f) => f && { ...f, submitting: false, error: data?.error?.message ?? "修正に失敗しました" });
    }
  }

  // 月オプション
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

  const targetMember = members.find((m) => m.id === targetMemberId);

  async function handleNewFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewForm((f) => ({ ...f, submitting: true, error: "" }));
    const body: Record<string, unknown> = {
      date: newForm.date,
      clockIn: newForm.clockIn || null,
      clockOut: newForm.clockOut || null,
      breakMinutes: Number(newForm.breakMinutes),
    };
    if (isAdmin && targetMemberId) body.memberId = targetMemberId;
    const res = await fetch("/api/attendances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await mutateRecords();
      setNewForm({ open: false, date: "", clockIn: "", clockOut: "", breakMinutes: "0", submitting: false, error: "" });
    } else {
      const data = await res.json().catch(() => ({}));
      setNewForm((f) => ({ ...f, submitting: false, error: data?.error?.message ?? "申請に失敗しました" }));
    }
  }

  function handleCSVDownload() {
    const header = ["日付", "出勤", "退勤", "休憩(分)", "実働(h)", "状態", "今日やったこと"];
    const rows = records.map((r) => [
      r.date,
      r.clockIn ?? "",
      r.clockOut ?? "",
      String(r.breakMinutes),
      r.actualHours != null ? String(r.actualHours) : "",
      STATUS_LABELS[r.status] ?? r.status,
      r.doneToday ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `勤怠_${targetMember?.name ?? "自分"}_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setNewForm((f) => ({ ...f, open: !f.open, error: "" }))}>
                <Plus size={14} /> 打刻申請
              </Button>
              <Button variant="outline" size="sm" onClick={handleCSVDownload}><Download size={14} /> CSV出力</Button>
            </div>
          </div>

          {/* 新規打刻申請フォーム */}
          {newForm.open && (
            <form onSubmit={handleNewFormSubmit} className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">日付</label>
                <input
                  type="date"
                  required
                  min={`${month}-01`}
                  max={`${month}-31`}
                  value={newForm.date}
                  onChange={(e) => setNewForm((f) => ({ ...f, date: e.target.value }))}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">出勤時刻</label>
                <input
                  type="time"
                  value={newForm.clockIn}
                  onChange={(e) => setNewForm((f) => ({ ...f, clockIn: e.target.value }))}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">退勤時刻</label>
                <input
                  type="time"
                  value={newForm.clockOut}
                  onChange={(e) => setNewForm((f) => ({ ...f, clockOut: e.target.value }))}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">休憩（分）</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={newForm.breakMinutes}
                  onChange={(e) => setNewForm((f) => ({ ...f, breakMinutes: e.target.value }))}
                  className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" size="sm" disabled={newForm.submitting}>
                  {newForm.submitting ? "送信中…" : "承認依頼を送る"}
                </Button>
                <button type="button" onClick={() => setNewForm((f) => ({ ...f, open: false, error: "" }))} className="text-xs text-slate-400 hover:text-slate-600">キャンセル</button>
              </div>
              {newForm.error && <p className="w-full text-xs text-red-500">{newForm.error}</p>}
            </form>
          )}
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
                  <th className="px-4 py-2.5 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((rec) => {
                  const approved = approvedIds.has(rec.id) || rec.confirmStatus === "approved";
                  const rejected = rejectedIds.has(rec.id) || rec.confirmStatus === "rejected";
                  const isToday = rec.date === jstToday;
                  const isEditing = editForm?.id === rec.id;

                  if (isEditing) {
                    return (
                      <tr key={rec.id} className="border-b border-slate-50 bg-amber-50">
                        <td className="px-4 py-2 text-slate-700">
                          {rec.date.slice(5).replace("-", "/")}
                          {isToday && <span className="ml-1 text-xs text-blue-600">今日</span>}
                        </td>
                        <td className="px-4 py-1.5">
                          <input type="time" value={editForm.clockIn} onChange={(e) => setEditForm((f) => f && { ...f, clockIn: e.target.value })} className="w-24 rounded border border-slate-300 px-1.5 py-1 text-sm focus:border-blue-500 focus:outline-none" />
                        </td>
                        <td className="px-4 py-1.5">
                          <input type="time" value={editForm.clockOut} onChange={(e) => setEditForm((f) => f && { ...f, clockOut: e.target.value })} className="w-24 rounded border border-slate-300 px-1.5 py-1 text-sm focus:border-blue-500 focus:outline-none" />
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <input type="number" min="0" step="5" value={editForm.breakMinutes} onChange={(e) => setEditForm((f) => f && { ...f, breakMinutes: e.target.value })} className="w-16 rounded border border-slate-300 px-1.5 py-1 text-sm text-right focus:border-blue-500 focus:outline-none" />
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-slate-400">—</td>
                        <td className="px-4 py-2">
                          <Badge variant="warning">修正中</Badge>
                        </td>
                        <td className="px-4 py-2">
                          {editForm.error && <span className="text-xs text-red-500">{editForm.error}</span>}
                        </td>
                        <td className="px-4 py-2">
                          <form onSubmit={handleEditSubmit} className="flex items-center gap-1.5">
                            <button type="submit" disabled={editForm.submitting} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                              {editForm.submitting ? "送信中…" : "保存"}
                            </button>
                            <span className="text-slate-300">|</span>
                            <button type="button" onClick={() => setEditForm(null)} className="text-xs text-slate-400 hover:text-slate-600">
                              取消
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  }

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
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => startEdit(rec)} className="text-slate-400 hover:text-blue-600" title="修正">
                            <Pencil size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              {approved ? (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle size={12} /> 承認済
                                </span>
                              ) : rejected ? (
                                <span className="flex items-center gap-1 text-xs text-red-500">
                                  <XCircle size={12} /> 否認済
                                </span>
                              ) : rec.isModified && rec.confirmStatus === "unconfirmed" ? (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    onClick={() => handleApprove(rec.id)}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    承認
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    onClick={() => handleReject(rec.id)}
                                    className="text-xs text-red-500 hover:underline"
                                  >
                                    否認
                                  </button>
                                </>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">該当する勤怠データがありません</div>
            )}
          </div>
          {records.length > visibleCount && (
            <div className="px-4 pb-4 pt-2 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((v) => v + 50)}>
                もっと見る（残り {records.length - visibleCount} 件）
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
