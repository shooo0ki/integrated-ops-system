"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type WorkType = "出社" | "オンライン" | "休み";

const WORK_TYPE_TO_LOCATION: Record<WorkType, string> = {
  "出社": "office", "オンライン": "online", "休み": "office",
};
const LOCATION_TO_WORK_TYPE: Record<string, WorkType> = {
  "office": "出社", "online": "オンライン",
};

interface DayEntry {
  date: string;       // YYYY-MM-DD
  dayLabel: string;
  isHoliday: boolean;
  isOff: boolean;
  plannedStart: string;
  plannedEnd: string;
  workType: WorkType;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DEFAULT_START = "09:30";
const DEFAULT_END = "18:30";

// 来週の月曜から日曜を生成
function buildNextWeek(): DayEntry[] {
  const today = new Date();
  const dow = today.getDay(); // 0=日
  const daysToNextMon = dow === 0 ? 1 : 8 - dow;
  const entries: DayEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + daysToNextMon + i);
    const dayLabel = DAY_LABELS[d.getDay()];
    const isHoliday = d.getDay() === 0 || d.getDay() === 6;
    entries.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dayLabel,
      isHoliday,
      isOff: isHoliday,
      plannedStart: DEFAULT_START,
      plannedEnd: DEFAULT_END,
      workType: "出社",
    });
  }
  return entries;
}

// ─── 管理者向け：未提出アラート ───────────────────────────

interface UnsubmittedData {
  from: string;
  to: string;
  total: number;
  unsubmitted: { memberId: string; memberName: string }[];
}

function AdminUnsubmittedAlert() {
  const [data, setData] = useState<UnsubmittedData | null>(null);

  useEffect(() => {
    fetch("/api/schedules/unsubmitted")
      .then((r) => r.ok ? r.json() : null)
      .then((d: UnsubmittedData | null) => setData(d))
      .catch(() => {});
  }, []);

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
  const [entries, setEntries] = useState<DayEntry[]>(buildNextWeek);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const nextWeek = entries;
  const weekLabel = nextWeek.length >= 7
    ? `${nextWeek[0].date.slice(5).replace("-", "/")} 〜 ${nextWeek[6].date.slice(5).replace("-", "/")}`
    : "";

  // 既存のスケジュールを取得して上書き
  useEffect(() => {
    if (!memberId) return;
    const from = nextWeek[0]?.date;
    const to = nextWeek[6]?.date;
    if (!from || !to) return;

    fetch(`/api/members/${memberId}/work-schedules?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((existing: { date: string; startTime: string | null; endTime: string | null; isOff: boolean; locationType: string }[]) => {
        if (!Array.isArray(existing) || existing.length === 0) return;
        setEntries((prev) =>
          prev.map((e) => {
            const found = existing.find((s) => s.date === e.date);
            if (!found) return e;
            return {
              ...e,
              isOff: found.isOff || e.isHoliday,
              plannedStart: found.startTime ?? DEFAULT_START,
              plannedEnd: found.endTime ?? DEFAULT_END,
              workType: LOCATION_TO_WORK_TYPE[found.locationType] ?? "出社",
            };
          })
        );
        setLoaded(true);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  function update(i: number, key: keyof DayEntry, value: string | boolean) {
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [key]: value } : e));
    setSaved(false);
  }

  function copyFromPrev() {
    setEntries((prev) =>
      prev.map((e) => ({ ...e, plannedStart: DEFAULT_START, plannedEnd: DEFAULT_END, workType: "出社", isOff: false }))
    );
  }

  function resetDefault() {
    setEntries(buildNextWeek());
    setSaved(false);
  }

  async function handleSave() {
    if (!memberId) return;
    setSaving(true);
    const payload = entries.map((e) => ({
      date: e.date,
      startTime: e.isOff ? null : e.plannedStart,
      endTime: e.isOff ? null : e.plannedEnd,
      isOff: e.isOff,
      locationType: WORK_TYPE_TO_LOCATION[e.workType],
    }));

    const res = await fetch(`/api/members/${memberId}/work-schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">勤務予定登録</h1>
        <p className="text-sm text-slate-500">{name} — 翌週（{weekLabel}）</p>
      </div>

      {(role === "admin" || role === "manager") && <AdminUnsubmittedAlert />}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={15} /> 勤務予定を保存しました
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={copyFromPrev}>
          <Copy size={14} /> 前週からコピー
        </Button>
        <Button variant="outline" size="sm" onClick={resetDefault}>
          <RotateCcw size={14} /> デフォルトに戻す
        </Button>
      </div>

      <Card>
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.date}
              className={`rounded-lg px-4 py-3 ${
                entry.isOff ? "bg-slate-50" : "bg-white border border-slate-200"
              }`}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-20">
                  <span
                    className={`font-semibold ${
                      entry.dayLabel === "土" ? "text-blue-500" : entry.dayLabel === "日" ? "text-red-500" : "text-slate-800"
                    }`}
                  >
                    {entry.dayLabel}
                  </span>
                  <span className="ml-1.5 text-xs text-slate-400">{entry.date.slice(5).replace("-", "/")}</span>
                </div>

                <>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.isOff}
                      onChange={(e) => update(i, "isOff", e.target.checked)}
                      className="rounded"
                    />
                    終日休み
                  </label>

                  {!entry.isOff && (
                    <>
                      <select
                        value={entry.workType}
                        onChange={(e) => update(i, "workType", e.target.value as WorkType)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option>出社</option>
                        <option>オンライン</option>
                      </select>

                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={entry.plannedStart}
                          onChange={(e) => update(i, "plannedStart", e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-slate-400 text-sm">〜</span>
                        <input
                          type="time"
                          value={entry.plannedEnd}
                          onChange={(e) => update(i, "plannedEnd", e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      {entry.plannedStart && entry.plannedEnd && (() => {
                        const [sh, sm] = entry.plannedStart.split(":").map(Number);
                        const [eh, em] = entry.plannedEnd.split(":").map(Number);
                        const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                        return <span className="text-xs text-slate-400">（実働 {h.toFixed(1)}h）</span>;
                      })()}
                    </>
                  )}
                </>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={handleSave} disabled={saving || !memberId}>
          <Save size={16} />
          {saving ? "保存中..." : "保存する"}
        </Button>
      </div>

      <p className="text-xs text-slate-400 text-right">※ 前日までは本人が変更可能。当日以降は管理者のみ</p>
    </div>
  );
}
