"use client";
import { Select } from "@/frontend/components/common/input";

import { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, CheckCircle, Save, AlertTriangle, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/frontend/contexts/auth-context";
import { Card } from "@/frontend/components/common/card";
import { ConfirmDialog } from "@/frontend/components/common/confirm-dialog";
import { Button } from "@/frontend/components/common/button";

interface WorkPlanRow {
  projectId: string;
  hours: number;
  note: string;
}

type WorkType = "出社" | "オンライン";

const WORK_TYPE_TO_LOCATION: Record<WorkType, string> = {
  "出社": "office", "オンライン": "online",
};
const LOCATION_TO_WORK_TYPE: Record<string, WorkType> = {
  "office": "出社", "online": "オンライン",
};

interface DayEntry {
  date: string;
  dayLabel: string;
  isHoliday: boolean;
  isOff: boolean;
  plannedStart: string;
  plannedEnd: string;
  workType: WorkType;
  note: string;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DEFAULT_START = "09:30";
const DEFAULT_END = "18:30";

/** 指定日を含む週（月〜日）を生成 */
function buildWeek(anchor: Date): DayEntry[] {
  const dow = anchor.getDay();
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dayLabel = DAY_LABELS[d.getDay()];
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dayLabel,
      isHoliday: d.getDay() === 0 || d.getDay() === 6,
      isOff: false,
      plannedStart: DEFAULT_START,
      plannedEnd: DEFAULT_END,
      workType: "出社" as WorkType,
      note: "",
    };
  });
}

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// ─── 管理者向け：未提出アラート ───────────────────────────

interface UnsubmittedData {
  from: string;
  to: string;
  total: number;
  unsubmitted: { memberId: string; memberName: string }[];
}

function AdminUnsubmittedAlert() {
  const { data } = useSWR<UnsubmittedData>("/api/schedules/unsubmitted");
  if (!data || data.unsubmitted.length === 0) return null;
  const weekLabel = `${data.from.slice(5).replace("-", "/")} 〜 ${data.to.slice(5).replace("-", "/")}`;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            翌週（{weekLabel}）の勤務予定が未提出のメンバーが {data.unsubmitted.length}名 います
          </p>
          <p className="mt-1.5 text-amber-700 text-xs">
            {data.unsubmitted.map((m) => m.memberName).join("、")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ページ本体 ───────────────────────────────────────────

export default function SchedulePage() {
  const { memberId, name, role } = useAuth();
  const isAdmin = role === "admin" || role === "manager";

  // 週ナビ: anchor を基準に週を計算
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = useMemo(() => todayStr(), []);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // PJ予定工数 (1-3-2, 1-3-3)
  const [workPlans, setWorkPlans] = useState<WorkPlanRow[]>([]);
  const { data: myProjects } = useSWR<{ id: string; name: string }[]>(
    memberId ? "/api/attendances/my-projects" : null
  );
  const HOURS_OPTIONS = useMemo(() => Array.from({ length: 33 }, (_, i) => i * 0.5), []);

  const addWorkPlan = useCallback(() => {
    setWorkPlans((prev) => [...prev, { projectId: "", hours: 0, note: "" }]);
  }, []);
  const removeWorkPlan = useCallback((idx: number) => {
    setWorkPlans((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const updateWorkPlan = useCallback((idx: number, field: keyof WorkPlanRow, value: string | number) => {
    setWorkPlans((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  // 初期表示: 来週
  useEffect(() => {
    const now = new Date();
    const dow = now.getDay();
    const nextMon = new Date(now);
    nextMon.setDate(now.getDate() + (dow === 0 ? 1 : 8 - dow));
    setAnchor(nextMon);
  }, []);

  // anchor が変わったら entries を再生成
  useEffect(() => {
    if (!anchor) return;
    setEntries(buildWeek(anchor));
    setSaved(false);
  }, [anchor]);

  const weekLabel = entries.length >= 7
    ? `${entries[0].date.slice(5).replace("-", "/")} 〜 ${entries[6].date.slice(5).replace("-", "/")}`
    : "";

  const from = entries[0]?.date;
  const to = entries[6]?.date;
  const { data: existingSchedules, mutate: mutateSchedules } = useSWR<{ date: string; startTime: string | null; endTime: string | null; isOff: boolean; locationType: string; note: string | null }[]>(
    memberId && from && to ? `/api/members/${memberId}/work-schedules?from=${from}&to=${to}` : null
  );

  const registeredDates = useMemo(
    () => new Set((existingSchedules ?? []).map((s) => s.date)),
    [existingSchedules]
  );

  // 週次PJ予定工数の取得
  const weekStart = from; // entries[0] = 月曜日
  const { data: existingPlans, mutate: mutatePlans } = useSWR<{ projectId: string; hours: number; note: string | null }[]>(
    memberId && weekStart ? `/api/members/${memberId}/work-plans?weekStart=${weekStart}` : null
  );

  useEffect(() => {
    if (!existingPlans) { setWorkPlans([]); return; }
    setWorkPlans(existingPlans.map((p) => ({ projectId: p.projectId, hours: p.hours, note: p.note ?? "" })));
  }, [existingPlans]);

  // 既存スケジュールを反映
  useEffect(() => {
    if (!Array.isArray(existingSchedules) || existingSchedules.length === 0) return;
    setEntries((prev) =>
      prev.map((e) => {
        const found = existingSchedules.find((s) => s.date === e.date);
        if (!found) return e;
        return {
          ...e,
          isOff: found.isOff || e.isHoliday,
          plannedStart: found.startTime ?? DEFAULT_START,
          plannedEnd: found.endTime ?? DEFAULT_END,
          workType: LOCATION_TO_WORK_TYPE[found.locationType] ?? "出社",
          note: found.note ?? "",
        };
      })
    );
  }, [existingSchedules]);

  // 週ナビ
  function prevWeek() {
    if (!anchor) return;
    const d = new Date(anchor);
    d.setDate(d.getDate() - 7);
    setAnchor(d);
  }
  function nextWeek() {
    if (!anchor) return;
    const d = new Date(anchor);
    d.setDate(d.getDate() + 7);
    setAnchor(d);
  }
  function goThisWeek() {
    setAnchor(new Date());
  }
  function goNextWeek() {
    const now = new Date();
    const dow = now.getDay();
    const nextMon = new Date(now);
    nextMon.setDate(now.getDate() + (dow === 0 ? 1 : 8 - dow));
    setAnchor(nextMon);
  }

  /** その日を編集可能か判定 */
  function canEditDay(date: string): boolean {
    if (isAdmin) return true;
    // メンバー: 当日以降は編集不可（前日までOK）
    return date > today;
  }

  function update(i: number, key: keyof DayEntry, value: string | boolean) {
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [key]: value } : e));
    setSaved(false);
  }

  async function handleDelete(date: string) {
    if (!memberId) return;
    const res = await fetch(`/api/members/${memberId}/work-schedules?date=${date}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.map((e) =>
        e.date === date ? { ...e, isOff: false, plannedStart: DEFAULT_START, plannedEnd: DEFAULT_END, workType: "出社" as WorkType, note: "" } : e
      ));
      await mutateSchedules();
    }
  }

  async function handleSave() {
    if (!memberId) return;
    setSaving(true);
    // 編集可能な日のみ送信
    const payload = entries
      .filter((e) => canEditDay(e.date))
      .map((e) => ({
        date: e.date,
        startTime: e.isOff ? null : e.plannedStart,
        endTime: e.isOff ? null : e.plannedEnd,
        isOff: e.isOff,
        locationType: WORK_TYPE_TO_LOCATION[e.workType] ?? "office",
        note: e.note || null,
      }));

    const [schedRes, planRes] = await Promise.all([
      fetch(`/api/members/${memberId}/work-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      weekStart
        ? fetch(`/api/members/${memberId}/work-plans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              weekStart,
              plans: workPlans
                .filter((p) => p.projectId && p.hours > 0)
                .map((p) => ({ projectId: p.projectId, hours: p.hours, note: p.note || undefined })),
            }),
          })
        : Promise.resolve({ ok: true } as Response),
    ]);
    setSaving(false);
    if (schedRes.ok) {
      setSaved(true);
      await Promise.all([mutateSchedules(), mutatePlans()]);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (!anchor) return null;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ヘッダー + 週ナビ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">勤務予定</h1>
          <p className="text-sm text-slate-500">{name} — {weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goThisWeek} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            今週
          </button>
          <button onClick={goNextWeek} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            来週
          </button>
          <div className="flex">
            <button onClick={prevWeek} className="rounded-l-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <button onClick={nextWeek} className="rounded-r-md border border-slate-200 border-l-0 p-1.5 text-slate-500 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {(role === "admin" || role === "manager") && <AdminUnsubmittedAlert />}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={15} /> 勤務予定を保存しました
        </div>
      )}

      {/* 日ごとのカード */}
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const isRegistered = registeredDates.has(entry.date);
          const editable = canEditDay(entry.date);
          const isPast = entry.date <= today;

          return (
            <Card key={entry.date}>
              <div className={`${!editable ? "opacity-60" : ""}`}>
                {/* 日付ヘッダー行 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* 登録状態ドット */}
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${isRegistered ? "bg-green-500" : "bg-slate-300"}`} />
                    <span className={`font-semibold ${
                      entry.dayLabel === "土" ? "text-blue-500" : entry.dayLabel === "日" ? "text-red-500" : "text-slate-800"
                    }`}>
                      {entry.date.slice(5).replace("-", "/")}({entry.dayLabel})
                    </span>
                    {/* ステータスバッジ */}
                    {isRegistered ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">登録済み</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">未登録</span>
                    )}
                    {isPast && !isAdmin && (
                      <span className="text-[10px] text-slate-400">（変更不可）</span>
                    )}
                  </div>
                  {/* 削除ボタン */}
                  {isRegistered && editable && (
                    <button
                      onClick={() => setDeleteTarget(entry.date)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="この日の予定を削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* フォーム行 */}
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.isOff}
                      onChange={(e) => update(i, "isOff", e.target.checked)}
                      disabled={!editable}
                      className="rounded"
                    />
                    終日休み
                  </label>

                  {!entry.isOff && (
                    <>
                      <Select
                        value={entry.workType}
                        onChange={(e) => update(i, "workType", e.target.value as WorkType)}
                        disabled={!editable}
                        className="px-2 py-1"
                      >
                        <option>出社</option>
                        <option>オンライン</option>
                      </Select>

                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={entry.plannedStart}
                          onChange={(e) => update(i, "plannedStart", e.target.value)}
                          disabled={!editable}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                        <span className="text-slate-400 text-sm">〜</span>
                        <input
                          type="time"
                          value={entry.plannedEnd}
                          onChange={(e) => update(i, "plannedEnd", e.target.value)}
                          disabled={!editable}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </div>

                      {entry.plannedStart && entry.plannedEnd && (() => {
                        const [sh, sm] = entry.plannedStart.split(":").map(Number);
                        const [eh, em] = entry.plannedEnd.split(":").map(Number);
                        const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                        return <span className="text-xs text-slate-400">（{h.toFixed(1)}h）</span>;
                      })()}
                    </>
                  )}
                </div>

                {/* 備考欄 */}
                <input
                  type="text"
                  placeholder="備考（例: この日はオンラインで対応）"
                  value={entry.note}
                  onChange={(e) => update(i, "note", e.target.value)}
                  disabled={!editable}
                  maxLength={200}
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </Card>
          );
        })}
      </div>

      {/* 週次PJ予定工数 (1-3-2, 1-3-3) */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">週間PJ予定工数</h2>
            <span className="text-xs text-slate-500">
              合計: {workPlans.reduce((s, p) => s + p.hours, 0).toFixed(1)}h
            </span>
          </div>
          <div className="space-y-2">
            {workPlans.map((plan, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={plan.projectId}
                  onChange={(e) => updateWorkPlan(idx, "projectId", e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm"
                >
                  <option value="">PJを選択</option>
                  {(myProjects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                <Select
                  value={String(plan.hours)}
                  onChange={(e) => updateWorkPlan(idx, "hours", parseFloat(e.target.value))}
                  className="w-20 shrink-0 px-2 py-1.5 text-sm"
                >
                  {HOURS_OPTIONS.map((h) => (
                    <option key={h} value={h}>{h.toFixed(1)}h</option>
                  ))}
                </Select>
                <input
                  type="text"
                  placeholder="備考"
                  value={plan.note}
                  onChange={(e) => updateWorkPlan(idx, "note", e.target.value)}
                  maxLength={200}
                  className="w-28 shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-sm placeholder:text-slate-300 focus:border-blue-500 focus:outline-none"
                />
                <button type="button" onClick={() => removeWorkPlan(idx)} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addWorkPlan}
              className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600"
            >
              <Plus size={12} /> PJ予定工数を追加
            </button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {isAdmin ? "※ 管理者はすべての日を変更可能" : "※ 当日以降は管理者のみ変更可能"}
        </p>
        <Button variant="primary" size="lg" onClick={handleSave} disabled={saving || !memberId}>
          <Save size={16} />
          {saving ? "保存中..." : "保存する"}
        </Button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="勤務予定を削除"
        description="この日の勤務予定を削除します。よろしいですか？"
        confirmLabel="削除する"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
