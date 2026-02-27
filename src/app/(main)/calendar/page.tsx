"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, FolderOpen, Monitor, Building2 } from "lucide-react";

// ─── 定数 ────────────────────────────────────────────────

const HOUR_PX    = 64;
const START_HOUR = 7;
const END_HOUR   = 31;  // 翌7時 (24+7)
const GRID_H     = (END_HOUR - START_HOUR) * HOUR_PX; // 24 * 64 = 1536
const TIME_W     = 52;
const DAY_MIN_W  = 120;
const HOURS      = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i); // 7..30

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const TODAY  = localDateStr(new Date());
const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];

const COLORS = [
  { bg: "bg-blue-100",    text: "text-blue-800",    bl: "border-l-blue-400",    hex: "#60a5fa" },
  { bg: "bg-emerald-100", text: "text-emerald-800", bl: "border-l-emerald-400", hex: "#34d399" },
  { bg: "bg-violet-100",  text: "text-violet-800",  bl: "border-l-violet-400",  hex: "#a78bfa" },
  { bg: "bg-orange-100",  text: "text-orange-800",  bl: "border-l-orange-400",  hex: "#fb923c" },
  { bg: "bg-pink-100",    text: "text-pink-800",    bl: "border-l-pink-400",    hex: "#f472b6" },
  { bg: "bg-teal-100",    text: "text-teal-800",    bl: "border-l-teal-400",    hex: "#2dd4bf" },
  { bg: "bg-amber-100",   text: "text-amber-800",   bl: "border-l-amber-400",   hex: "#fbbf24" },
  { bg: "bg-rose-100",    text: "text-rose-800",    bl: "border-l-rose-400",    hex: "#fb7185" },
];

// ─── 勤務場所ラベル ───────────────────────────────────────

const LOCATION_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  office: { label: "出社",      icon: <Building2 size={9} />, cls: "bg-green-100 text-green-700" },
  online: { label: "オンライン", icon: <Monitor   size={9} />, cls: "bg-blue-100 text-blue-700"  },
};

// ─── 型定義 ──────────────────────────────────────────────

interface CalMember   { id: string; name: string; projectIds: string[] }
interface CalProject  { id: string; name: string }
interface SchedEntry  { memberId: string; date: string; startTime: string | null; endTime: string | null; isOff: boolean; locationType: string }
interface AttEntry    { memberId: string; date: string; clockIn: string | null; clockOut: string | null; confirmStatus: string; locationType: string }
interface CalData     { members: CalMember[]; schedules: SchedEntry[]; attendances: AttEntry[]; projects: CalProject[] }
type ViewMode         = "week" | "month";

// ─── ユーティリティ ──────────────────────────────────────

function dateStr(d: Date) { return localDateStr(d); }

// 0〜6時は翌日扱い（+24）して7〜31の空間にマッピング
function normalizeHour(h: number): number {
  return h < START_HOUR ? h + 24 : h;
}

function timeToY(t: string): number {
  const [hRaw, m] = t.split(":").map(Number);
  const h = normalizeHour(hRaw);
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, h * 60 + m));
  return ((clamped - START_HOUR * 60) / 60) * HOUR_PX;
}

function spanPx(start: string, end: string): number {
  const [h1r, m1] = start.split(":").map(Number);
  const [h2r, m2] = end.split(":").map(Number);
  let h1 = normalizeHour(h1r);
  let h2 = normalizeHour(h2r);
  // 終了が開始より前なら翌日扱い（深夜勤務）
  if (h2 <= h1) h2 += 24;
  const s = Math.max(START_HOUR * 60, h1 * 60 + m1);
  const e = Math.min(END_HOUR   * 60, h2 * 60 + m2);
  return Math.max(HOUR_PX / 4, ((e - s) / 60) * HOUR_PX);
}

function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function nowY() {
  const n = new Date();
  const h = normalizeHour(n.getHours());
  return ((h * 60 + n.getMinutes() - START_HOUR * 60) / 60) * HOUR_PX;
}

function buildWeekDays(anchor: Date) {
  const dow = anchor.getDay();
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds = dateStr(d);
    return { date: ds, dayLabel: DOW_JP[d.getDay()], dayNum: d.getDate(),
             isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: ds === TODAY };
  });
}

function buildMonthGrid(year: number, month: number) {
  const first  = new Date(year, month - 1, 1);
  const offset = first.getDay() === 0 ? -6 : 1 - first.getDay();
  const start  = new Date(first); start.setDate(first.getDate() + offset);
  const cur    = new Date(start);
  const weeks: { date: string; dayNum: number; isCurrentMonth: boolean; isWeekend: boolean; isToday: boolean }[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const ds = dateStr(cur);
      week.push({ date: ds, dayNum: cur.getDate(),
                  isCurrentMonth: cur.getMonth() === month - 1,
                  isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
                  isToday: ds === TODAY });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur.getMonth() !== month - 1 && w >= 4) break;
  }
  return weeks;
}

// ─── ロケーションバッジ ───────────────────────────────────

function LocationBadge({ locationType }: { locationType: string }) {
  const cfg = LOCATION_CONFIG[locationType];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-medium leading-none ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── WeekView ─────────────────────────────────────────────

function WeekView({ weekDays, visible, calData }: {
  weekDays: ReturnType<typeof buildWeekDays>;
  visible:  CalMember[];
  calData:  CalData;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentY, setCurrentY] = useState(nowY());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, currentY - 120);
    }
    const t = setInterval(() => setCurrentY(nowY()), 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorMap = new Map(calData.members.map((m, i) => [m.id, COLORS[i % COLORS.length]]));
  const colPct   = visible.length > 0 ? 100 / visible.length : 100;

  function att(memberId: string, date: string)   { return calData.attendances.find(a => a.memberId === memberId && a.date === date) ?? null; }
  function sched(memberId: string, date: string) { return calData.schedules.find(s => s.memberId === memberId && s.date === date) ?? null;  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="flex border-b border-slate-200 shrink-0 overflow-x-hidden bg-white z-20 shadow-sm">
        <div style={{ width: TIME_W, minWidth: TIME_W }} className="border-r border-slate-100 shrink-0" />
        {weekDays.map(day => (
          <div key={day.date}
            className={`flex-1 py-2.5 text-center border-r border-slate-100 last:border-r-0 ${
              day.isToday ? "bg-blue-50" : day.isWeekend ? "bg-slate-50" : ""
            }`}
            style={{ minWidth: DAY_MIN_W }}
          >
            <p className="text-xs font-medium text-slate-400">{day.dayLabel}</p>
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold mx-auto mt-0.5 ${
              day.isToday ? "bg-blue-600 text-white" : day.isWeekend ? "text-slate-400" : "text-slate-700"
            }`}>
              {day.dayNum}
            </span>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: "calc(100vh - 360px)", minHeight: 360 }}>
        <div className="flex" style={{ minWidth: TIME_W + DAY_MIN_W * 7 }}>
          <div
            className="shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10 select-none"
            style={{ width: TIME_W, minWidth: TIME_W, height: GRID_H }}
          >
            {HOURS.map(h => (
              <div key={h} className="absolute w-full" style={{ top: (h - START_HOUR) * HOUR_PX - 8, left: 0 }}>
                <span className={`block pr-2 text-right text-xs leading-none ${h === 24 ? "font-bold text-slate-600" : "text-slate-400"}`}>
                  {String(h % 24).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {weekDays.map(day => (
            <div key={day.date}
              className={`flex-1 border-r border-slate-100 last:border-r-0 relative ${
                day.isWeekend ? "bg-slate-50/50" : day.isToday ? "bg-blue-50/20" : ""
              }`}
              style={{ minWidth: DAY_MIN_W }}
            >
              <div className="relative" style={{ height: GRID_H }}>
                {HOURS.map(h => (
                  <div key={h} className={`absolute inset-x-0 border-t ${h === 24 ? "border-slate-400 border-dashed z-[1]" : "border-slate-100"}`}
                    style={{ top: (h - START_HOUR) * HOUR_PX }} />
                ))}
                {HOURS.map(h => (
                  <div key={`${h}h`} className="absolute inset-x-0 border-t border-slate-50" style={{ top: (h - START_HOUR) * HOUR_PX + HOUR_PX / 2 }} />
                ))}
                {/* 深夜ラベル */}
                <div className="absolute inset-x-0 pointer-events-none z-[1]"
                  style={{ top: (24 - START_HOUR) * HOUR_PX - 9 }}>
                  <span className="absolute right-1 text-[9px] font-bold text-slate-500 bg-white px-0.5 leading-none">日付変更</span>
                </div>

                {day.isToday && currentY >= 0 && currentY <= GRID_H && (
                  <div className="absolute inset-x-0 z-10 flex items-center pointer-events-none" style={{ top: currentY }}>
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}

                {!day.isWeekend && visible.map((member, mi) => {
                  const color = colorMap.get(member.id) ?? COLORS[0];
                  const a     = att(member.id, day.date);
                  const s     = sched(member.id, day.date);
                  const left  = `${mi * colPct + 0.5}%`;
                  const width = `${colPct - 1}%`;

                  return (
                    <div key={member.id}>
                      {/* 予定ブロック（実績がない場合のみ） */}
                      {s && !s.isOff && s.startTime && !a?.clockIn && (
                        <div
                          className={`absolute rounded-md border-l-2 overflow-hidden opacity-60 ${color.bg} ${color.bl}`}
                          style={{
                            top:    timeToY(s.startTime) + 1,
                            height: Math.max(20, spanPx(s.startTime, s.endTime ?? `${END_HOUR}:00`) - 2),
                            left, width, padding: "2px 4px",
                          }}
                        >
                          <p className={`text-xs font-medium truncate leading-tight ${color.text}`}>{member.name}</p>
                          <p className={`text-xs truncate leading-tight ${color.text} opacity-70`}>
                            {s.startTime}〜{s.endTime ?? ""}
                          </p>
                          <LocationBadge locationType={s.locationType} />
                        </div>
                      )}

                      {/* 実績ブロック */}
                      {a?.clockIn && (
                        <div
                          className={`absolute rounded-md border-l-2 overflow-hidden ${color.bg} ${color.bl}`}
                          style={{
                            top:    timeToY(a.clockIn) + 1,
                            height: Math.max(28, spanPx(a.clockIn, a.clockOut ?? nowTimeStr()) - 2),
                            left, width, padding: "2px 4px",
                          }}
                        >
                          <p className={`text-xs font-semibold truncate leading-tight ${color.text}`}>{member.name}</p>
                          <p className={`text-xs truncate leading-tight ${color.text} opacity-80`}>
                            {a.clockIn}〜{a.clockOut ?? "勤務中"}
                          </p>
                          <LocationBadge locationType={a.locationType} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MonthView ────────────────────────────────────────────

function MonthView({ grid, visible, calData }: {
  grid:    ReturnType<typeof buildMonthGrid>;
  visible: CalMember[];
  calData: CalData;
}) {
  const colorMap = new Map(calData.members.map((m, i) => [m.id, COLORS[i % COLORS.length]]));

  function getEvent(memberId: string, date: string) {
    const a = calData.attendances.find(a => a.memberId === memberId && a.date === date);
    const s = calData.schedules.find(s => s.memberId === memberId && s.date === date);
    if (a?.clockIn) return { type: "actual" as const, clockIn: a.clockIn, clockOut: a.clockOut, locationType: a.locationType };
    if (s && !s.isOff && s.startTime) return { type: "schedule" as const, startTime: s.startTime, endTime: s.endTime, locationType: s.locationType };
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {["月", "火", "水", "木", "金", "土", "日"].map(d => (
          <div key={d} className={`py-2.5 text-center text-xs font-semibold ${d === "土" || d === "日" ? "text-slate-400" : "text-slate-500"}`}>
            {d}
          </div>
        ))}
      </div>
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
          {week.map(day => (
            <div key={day.date}
              className={`min-h-[96px] p-1.5 border-r border-slate-100 last:border-r-0 ${
                !day.isCurrentMonth ? "bg-slate-50/60" : day.isWeekend ? "bg-slate-50/30" : ""
              }`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                day.isToday ? "bg-blue-600 text-white" :
                !day.isCurrentMonth ? "text-slate-300" :
                day.isWeekend ? "text-slate-400" : "text-slate-700"
              }`}>
                {day.dayNum}
              </span>
              <div className="space-y-0.5">
                {visible.map(member => {
                  const ev    = getEvent(member.id, day.date);
                  if (!ev) return null;
                  const color = colorMap.get(member.id) ?? COLORS[0];
                  return (
                    <div key={member.id}
                      className={`flex flex-col rounded px-1.5 py-0.5 text-xs truncate border-l-2 ${color.bg} ${color.text} ${color.bl} ${
                        ev.type === "schedule" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-medium truncate">{member.name}</span>
                      </div>
                      <LocationBadge locationType={ev.locationType} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── ページ ───────────────────────────────────────────────

export default function CalendarPage() {
  const [view,          setView]          = useState<ViewMode>("week");
  const [anchor,        setAnchor]        = useState(() => new Date());
  const [displayYear,   setDisplayYear]   = useState(() => new Date().getFullYear());
  const [displayMonth,  setDisplayMonth]  = useState(() => new Date().getMonth() + 1);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [selectedProjId, setSelectedProjId] = useState<string>("");
  const [calData,       setCalData]       = useState<CalData>({ members: [], schedules: [], attendances: [], projects: [] });
  const [loading,       setLoading]       = useState(true);
  const initialized = useRef(false);

  const weekDays  = buildWeekDays(anchor);
  const monthGrid = buildMonthGrid(displayYear, displayMonth);

  const from = view === "week" ? weekDays[0].date : monthGrid[0][0].date;
  const to   = view === "week" ? weekDays[6].date : monthGrid[monthGrid.length - 1][6].date;

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/calendar?from=${from}&to=${to}`);
    if (res.ok) {
      const data: CalData = await res.json();
      setCalData(data);
      if (!initialized.current && data.members.length > 0) {
        setSelectedIds(new Set(data.members.map(m => m.id)));
        initialized.current = true;
      }
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  // プロジェクトフィルター適用後の表示メンバー
  const projectFilteredMembers = selectedProjId
    ? calData.members.filter(m => m.projectIds.includes(selectedProjId))
    : calData.members;

  const visibleMembers = projectFilteredMembers.filter(m => selectedIds.has(m.id));

  function toggleMember(id: string) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function selectAll()   { setSelectedIds(new Set(projectFilteredMembers.map(m => m.id))); }
  function deselectAll() { setSelectedIds(new Set()); }

  function handleProjectFilter(projId: string) {
    setSelectedProjId(projId);
    // プロジェクト選択時はそのプロジェクトのメンバーだけ選択
    if (projId) {
      const projMembers = calData.members.filter(m => m.projectIds.includes(projId));
      setSelectedIds(new Set(projMembers.map(m => m.id)));
    } else {
      setSelectedIds(new Set(calData.members.map(m => m.id)));
    }
  }

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth() + 1);
  }
  function prev() {
    if (view === "week") {
      const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d);
    } else {
      let m = displayMonth - 1, y = displayYear;
      if (m < 1) { m = 12; y--; }
      setDisplayMonth(m); setDisplayYear(y);
    }
  }
  function next() {
    if (view === "week") {
      const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d);
    } else {
      let m = displayMonth + 1, y = displayYear;
      if (m > 12) { m = 1; y++; }
      setDisplayMonth(m); setDisplayYear(y);
    }
  }

  const weekLabel = `${weekDays[0].date.slice(5).replace("-", "/")} 〜 ${weekDays[6].date.slice(5).replace("-", "/")}`;

  return (
    <div className="space-y-4">
      {/* ─ ヘッダー ─ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">全体カレンダー</h1>
          <p className="text-sm text-slate-500">
            {view === "week" ? weekLabel : `${displayYear}年${displayMonth}月`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={goToday}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            今日
          </button>
          <div className="flex gap-0.5">
            <button onClick={prev} className="rounded-l-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
              <ChevronLeft size={16} />
            </button>
            <button onClick={next} className="rounded-r-md border border-slate-200 border-l-0 p-1.5 text-slate-500 hover:bg-slate-50">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["week", "month"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  view === v ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
                }`}>
                {v === "week" ? "週" : "月"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─ フィルターパネル ─ */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3">

        {/* プロジェクトフィルター */}
        {calData.projects.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
              <FolderOpen size={13} />
              <span>プロジェクト:</span>
            </div>
            <button
              onClick={() => handleProjectFilter("")}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                !selectedProjId
                  ? "bg-slate-700 text-white border-transparent"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              全員
            </button>
            {calData.projects.map(p => (
              <button
                key={p.id}
                onClick={() => handleProjectFilter(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  selectedProjId === p.id
                    ? "bg-blue-600 text-white border-transparent"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-blue-50"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* メンバーフィルター */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users size={13} />
            <span>{visibleMembers.length}<span className="text-slate-400">/{projectFilteredMembers.length}名</span></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <div className="flex gap-1 mr-1 shrink-0">
            <button onClick={selectAll}   className="text-xs text-blue-600 hover:underline">全選択</button>
            <span className="text-slate-300 select-none">|</span>
            <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">解除</button>
          </div>
          {projectFilteredMembers.map((m, gi) => {
            const color = COLORS[calData.members.findIndex(cm => cm.id === m.id) % COLORS.length];
            const on    = selectedIds.has(m.id);
            return (
              <button key={m.id} onClick={() => toggleMember(m.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                  on ? `${color.bg} ${color.text} border-transparent` : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: on ? color.hex : "#cbd5e1" }} />
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-5 text-xs text-slate-500 px-1 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3.5 rounded-sm border-l-2 border-l-blue-400 bg-blue-100 opacity-60" />
          勤務予定
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3.5 rounded-sm border-l-2 border-l-blue-400 bg-blue-100" />
          勤怠実績
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
          現在時刻
        </span>
        <span className="flex items-center gap-1">
          <Building2 size={11} className="text-green-600" />
          <span className="text-green-700">出社</span>
        </span>
        <span className="flex items-center gap-1">
          <Monitor size={11} className="text-blue-600" />
          <span className="text-blue-700">オンライン</span>
        </span>
      </div>

      {/* ─ カレンダー本体 ─ */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">読み込み中...</div>
      ) : view === "week" ? (
        <WeekView weekDays={weekDays} visible={visibleMembers} calData={calData} />
      ) : (
        <MonthView grid={monthGrid} visible={visibleMembers} calData={calData} />
      )}
    </div>
  );
}
