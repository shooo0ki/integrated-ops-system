"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ViewMode = "week" | "month";

interface CalendarMember {
  id: string;
  name: string;
  company: string;
}

interface ScheduleEntry {
  memberId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isOff: boolean;
}

interface AttendanceEntry {
  memberId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  confirmStatus: string;
}

interface CalendarData {
  members: CalendarMember[];
  schedules: ScheduleEntry[];
  attendances: AttendanceEntry[];
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 週の月曜〜日曜を生成
function buildWeekDays(anchor: Date) {
  const dow = anchor.getDay(); // 0=日
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() + daysToMon);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      dayLabel: DAY_LABELS[d.getDay()],
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: dateStr === new Date().toISOString().slice(0, 10),
    });
  }
  return days;
}

// 月の1日〜末日を生成
function buildMonthDays(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(dateStr).getDay();
    days.push({
      date: dateStr,
      day: d,
      dow,
      isWeekend: dow === 0 || dow === 6,
      isToday: dateStr === new Date().toISOString().slice(0, 10),
    });
  }
  return days;
}

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date()); // 週ビューの基準日
  const [displayYear, setDisplayYear] = useState(() => new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => new Date().getMonth() + 1);
  const [companyFilter, setCompanyFilter] = useState<"ALL" | "boost" | "salt2">("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");

  const [calData, setCalData] = useState<CalendarData>({ members: [], schedules: [], attendances: [] });
  const [loading, setLoading] = useState(true);

  const weekDays = buildWeekDays(anchor);
  const monthDays = buildMonthDays(displayYear, displayMonth);

  const from = view === "week" ? weekDays[0].date : monthDays[0].date;
  const to = view === "week" ? weekDays[6].date : monthDays[monthDays.length - 1].date;

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/calendar?from=${from}&to=${to}`);
    if (res.ok) {
      setCalData(await res.json());
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleMembers = calData.members.filter((m) => {
    const matchCompany = companyFilter === "ALL" || m.company === companyFilter;
    const matchMember = memberFilter === "ALL" || m.id === memberFilter;
    return matchCompany && matchMember;
  });

  // セルのステータスを判定
  function getCellStatus(memberId: string, date: string) {
    const att = calData.attendances.find((a) => a.memberId === memberId && a.date === date);
    const sched = calData.schedules.find((s) => s.memberId === memberId && s.date === date);

    if (att?.clockIn && att?.clockOut) return { kind: "actual" as const, att, sched };
    if (att?.clockIn) return { kind: "working" as const, att, sched };
    if (sched && !sched.isOff) return { kind: "planned" as const, att: null, sched };
    if (sched?.isOff) return { kind: "off" as const, att: null, sched };
    return null;
  }

  const weekLabel = weekDays.length >= 7
    ? `${weekDays[0].date.slice(5).replace("-", "/")} 〜 ${weekDays[6].date.slice(5).replace("-", "/")}`
    : "";

  // 前後ナビ
  function prevWeek() {
    const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d);
  }
  function nextWeek() {
    const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d);
  }
  function prevMonth() {
    let m = displayMonth - 1, y = displayYear;
    if (m < 1) { m = 12; y--; }
    setDisplayMonth(m); setDisplayYear(y);
  }
  function nextMonth() {
    let m = displayMonth + 1, y = displayYear;
    if (m > 12) { m = 1; y++; }
    setDisplayMonth(m); setDisplayYear(y);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">全体カレンダー</h1>
          <p className="text-sm text-slate-500">
            {view === "week" ? weekLabel : `${displayYear}年${displayMonth}月`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ナビゲーション */}
          <button onClick={view === "week" ? prevWeek : prevMonth}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
            <ChevronLeft size={16} />
          </button>
          <button onClick={view === "week" ? nextWeek : nextMonth}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
            <ChevronRight size={16} />
          </button>
          {/* 表示切替 */}
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["week", "month"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${view === v ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                {v === "week" ? "週" : "月"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 flex-wrap">
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value as "ALL" | "boost" | "salt2")}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
          <option value="ALL">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </select>
        <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
          <option value="ALL">全メンバー</option>
          {calData.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-50 border border-slate-200" /> 予定</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-200" /> 実績</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-100" /> 出勤中</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-50 border" /> 休日</span>
      </div>

      {loading && <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>}

      {/* 週ビュー */}
      {!loading && view === "week" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 min-w-[140px]">メンバー</th>
                {weekDays.map((d) => (
                  <th key={d.date}
                    className={`px-2 py-2.5 text-center font-medium min-w-[80px] ${d.isToday ? "text-blue-600 bg-blue-50" : d.isWeekend ? "text-slate-400 bg-slate-50" : "text-slate-600"}`}>
                    {d.dayLabel}<br />
                    <span className="text-slate-400 font-normal">{d.date.slice(5).replace("-", "/")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="sticky left-0 bg-white border-r border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={member.company === "boost" ? "boost" : "salt2"} className="text-xs px-1.5 py-0">
                        {member.company === "boost" ? "B" : "S"}
                      </Badge>
                      <Link href={`/members/${member.id}`} className="font-medium text-slate-700 hover:text-blue-600">
                        {member.name}
                      </Link>
                    </div>
                  </td>
                  {weekDays.map((d) => {
                    const cell = getCellStatus(member.id, d.date);
                    return (
                      <td key={d.date}
                        className={`px-1 py-1.5 text-center ${d.isWeekend ? "bg-slate-50" : !cell || cell.kind === "off" ? "" : cell.kind === "actual" ? "bg-green-50" : cell.kind === "working" ? "bg-blue-50" : "bg-green-50"}`}>
                        {d.isWeekend || !cell || cell.kind === "off" ? (
                          <span className="text-slate-300">—</span>
                        ) : cell.kind === "actual" ? (
                          <div className="text-green-700">
                            <p>{cell.att!.clockIn}</p>
                            <p className="text-green-500">{cell.att!.clockOut}</p>
                          </div>
                        ) : cell.kind === "working" ? (
                          <div className="text-blue-600">
                            <p>{cell.att!.clockIn}</p>
                            <p className="text-xs text-blue-400">勤務中</p>
                          </div>
                        ) : (
                          <div className="text-slate-500">
                            <p>{cell.sched!.startTime}</p>
                            <p className="text-slate-400">{cell.sched!.endTime}</p>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {visibleMembers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    表示するメンバーがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 月ビュー */}
      {!loading && view === "month" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
          <table className="text-xs border-collapse" style={{ minWidth: `${140 + monthDays.length * 36}px` }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 min-w-[140px]">メンバー</th>
                {monthDays.map((d) => (
                  <th key={d.date}
                    className={`px-1 py-2 text-center w-9 font-medium ${d.isToday ? "text-blue-600 bg-blue-50" : d.isWeekend ? "text-slate-400 bg-slate-50" : "text-slate-600"}`}>
                    {d.day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="sticky left-0 bg-white border-r border-slate-200 px-3 py-2">
                    <Link href={`/members/${member.id}`} className="font-medium text-slate-700 hover:text-blue-600">
                      {member.name}
                    </Link>
                  </td>
                  {monthDays.map((d) => {
                    const cell = getCellStatus(member.id, d.date);
                    return (
                      <td key={d.date} className={`w-9 py-2 text-center ${d.isWeekend ? "bg-slate-50" : ""}`}>
                        {d.isWeekend ? <span className="text-slate-200">·</span>
                          : cell?.kind === "actual" ? <span className="text-green-600">●</span>
                          : cell?.kind === "working" ? <span className="text-blue-500">●</span>
                          : cell?.kind === "planned" ? <span className="text-green-400">○</span>
                          : <span className="text-slate-200">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
