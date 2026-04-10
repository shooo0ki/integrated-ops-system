"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users, FolderOpen, Building2, Monitor } from "lucide-react";
import { COLORS } from "@/frontend/constants/calendar";
import type { ViewMode } from "@/shared/types/calendar";
import { useCalendarData } from "@/frontend/hooks/calendar/use-calendar-data";
import { WeekView } from "@/frontend/components/domain/calendar/week-view";
import { MonthView } from "@/frontend/components/domain/calendar/month-view";
import { DayView } from "@/frontend/components/domain/calendar/day-view";
import { CalendarSkeleton, InlineSkeleton } from "@/frontend/components/common/skeleton";

export default function CalendarPage() {
  const {
    view, anchor, displayYear, displayMonth, selectedIds, selectedProjId, loading,
    calData, weekDays, monthGrid, memberColorMap, projectFilteredMembers, visibleMembers,
    weekLabel, dayLabel, selectedDate,
    setView, toggleMember, selectAll, deselectAll, handleProjectFilter, goToday, goToDay, prev, next,
  } = useCalendarData();

  const [filterOpen, setFilterOpen] = useState(false);

  if (!anchor) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="space-y-3">
      {/* ─ ヘッダー ─ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-slate-800">全体カレンダー</h1>
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
            {(["day", "week", "month"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  view === v ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
                }`}>
                {v === "day" ? "日" : v === "week" ? "週" : "月"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─ 表示期間 ─ */}
      <div className="text-center">
        <p className="text-2xl font-bold text-slate-800">
          {view === "day" ? dayLabel : view === "week" ? weekLabel : `${displayYear}年${displayMonth}月`}
        </p>
      </div>

      {/* ─ フィルターパネル（折りたたみ） ─ */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-slate-600 font-medium">
            <Users size={14} />
            絞り込み（プロジェクト / メンバー）
            <span className="text-xs text-slate-400 font-normal">
              {visibleMembers.length}/{projectFilteredMembers.length}名 選択中
            </span>
          </span>
          {filterOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {filterOpen && (
          <div className="border-t border-slate-100 px-4 py-3 space-y-3">
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

            <div className="flex flex-wrap gap-1.5 items-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 mr-1">
                <Users size={13} />
                <span>メンバー:</span>
              </div>
              <div className="flex gap-1 mr-1 shrink-0">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">全選択</button>
                <span className="text-slate-300 select-none">|</span>
                <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">解除</button>
              </div>
              {projectFilteredMembers.map((m) => {
                const color = memberColorMap.get(m.id) ?? COLORS[0];
                const on = selectedIds === null || selectedIds.has(m.id);
                return (
                  <button key={m.id} onClick={() => toggleMember(m.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      on ? `${color.bg} ${color.text} ${color.bl}` : "bg-white text-slate-400 border-slate-200"
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
        )}
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-5 text-xs text-slate-500 px-1 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3.5 rounded-sm border-l-2 border-dashed border-l-blue-400 bg-blue-100 opacity-30" />
          勤務予定
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3.5 rounded-sm border-l-2 border-l-blue-400 bg-blue-100" />
          勤怠実績
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
          勤務中
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
        <InlineSkeleton />
      ) : view === "day" && selectedDate ? (
        <DayView date={selectedDate} visible={visibleMembers} calData={calData} />
      ) : view === "week" ? (
        <WeekView weekDays={weekDays} visible={visibleMembers} calData={calData} onDateClick={goToDay} />
      ) : (
        <MonthView grid={monthGrid} visible={visibleMembers} calData={calData} onDateClick={goToDay} />
      )}
    </div>
  );
}
