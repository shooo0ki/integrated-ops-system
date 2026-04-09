"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { COLORS, DOW_JP } from "@/frontend/constants/calendar";
import type { CalData, ViewMode } from "@/shared/types/calendar";
import { localDateStr, buildWeekDays, buildMonthGrid } from "@/frontend/components/domain/calendar/calendar-utils";

export function useCalendarData() {
  const { memberId: myMemberId, role } = useAuth();
  const isAdmin = role === "admin" || role === "manager";
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [displayYear, setDisplayYear] = useState(0);
  const [displayMonth, setDisplayMonth] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(new Set());
  const [selectedProjId, setSelectedProjId] = useState<string>("");
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const now = new Date();
    setToday(localDateStr(now));
    setAnchor(now);
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth() + 1);
  }, []);

  // 初回ロード時に自分を選択状態にする
  useEffect(() => {
    if (myMemberId && !hasInitialized.current) {
      hasInitialized.current = true;
      setSelectedIds(new Set([myMemberId]));
    }
  }, [myMemberId]);

  const weekDays = useMemo(() => anchor && today ? buildWeekDays(anchor, today) : [], [anchor, today]);
  const monthGrid = useMemo(() => displayYear && today ? buildMonthGrid(displayYear, displayMonth, today) : [], [displayYear, displayMonth, today]);

  const from = view === "day" && selectedDate
    ? selectedDate
    : view === "week" ? weekDays[0]?.date : monthGrid[0]?.[0]?.date;
  const to = view === "day" && selectedDate
    ? selectedDate
    : view === "week" ? weekDays[6]?.date : monthGrid[monthGrid.length - 1]?.[6]?.date;

  const calUrl = from && to ? `/api/calendar?from=${from}&to=${to}` : null;

  const { data: calData = { members: [], schedules: [], attendances: [], projects: [] }, isLoading: loading } = useSWR<CalData>(
    calUrl,
    { keepPreviousData: true },
  );

  // 自分は常に COLORS[0]（青）、他メンバーは残りの色を順番に割り当て
  const memberColorMap = useMemo(() => {
    const map = new Map<string, typeof COLORS[number]>();
    if (myMemberId) map.set(myMemberId, COLORS[0]);
    let ci = 1;
    for (const m of calData.members) {
      if (m.id === myMemberId) continue;
      map.set(m.id, COLORS[ci % COLORS.length]);
      ci++;
    }
    return map;
  }, [calData.members, myMemberId]);

  const projectFilteredMembers = useMemo(
    () => (selectedProjId
      ? calData.members.filter((m) => m.projectIds.includes(selectedProjId))
      : calData.members),
    [calData.members, selectedProjId]
  );

  const visibleMembers = useMemo(
    () => (selectedIds === null
      ? projectFilteredMembers
      : projectFilteredMembers.filter((m) => selectedIds.has(m.id))),
    [projectFilteredMembers, selectedIds]
  );

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const base = prev ?? new Set(calData.members.map(m => m.id));
      const s = new Set(base);
      s.has(id) ? s.delete(id) : s.add(id);
      if (calData.members.length > 0 && s.size === calData.members.length &&
          calData.members.every(m => s.has(m.id))) return null;
      return s;
    });
  }

  function selectAll() { setSelectedIds(null); }
  function deselectAll() { setSelectedIds(new Set()); }

  function handleProjectFilter(projId: string) {
    setSelectedProjId(projId);
    if (projId) {
      const projMembers = calData.members.filter(m => m.projectIds.includes(projId));
      setSelectedIds(new Set(projMembers.map(m => m.id)));
    } else {
      setSelectedIds(isAdmin ? null : (myMemberId ? new Set([myMemberId]) : new Set()));
    }
  }

  function goToDay(dateStr: string) {
    setSelectedDate(dateStr);
    setView("day");
  }

  function setViewWrapped(v: ViewMode) {
    if (v === "day" && !selectedDate) setSelectedDate(today);
    setView(v);
  }

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth() + 1);
    if (view === "day") setSelectedDate(localDateStr(now));
  }

  function prev() {
    if (view === "day") {
      if (!selectedDate) return;
      const d = new Date(`${selectedDate}T00:00:00`);
      d.setDate(d.getDate() - 1);
      setSelectedDate(localDateStr(d));
    } else if (view === "week") {
      if (!anchor) return;
      const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d);
    } else {
      let m = displayMonth - 1, y = displayYear;
      if (m < 1) { m = 12; y--; }
      setDisplayMonth(m); setDisplayYear(y);
    }
  }

  function next() {
    if (view === "day") {
      if (!selectedDate) return;
      const d = new Date(`${selectedDate}T00:00:00`);
      d.setDate(d.getDate() + 1);
      setSelectedDate(localDateStr(d));
    } else if (view === "week") {
      if (!anchor) return;
      const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d);
    } else {
      let m = displayMonth + 1, y = displayYear;
      if (m > 12) { m = 1; y++; }
      setDisplayMonth(m); setDisplayYear(y);
    }
  }

  const weekLabel = weekDays.length >= 7
    ? `${weekDays[0].date.slice(5).replace("-", "/")} 〜 ${weekDays[6].date.slice(5).replace("-", "/")}`
    : "";

  const dayLabel = selectedDate
    ? (() => {
        const d = new Date(`${selectedDate}T00:00:00`);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${DOW_JP[d.getDay()]})`;
      })()
    : "";

  return {
    view, anchor, displayYear, displayMonth, selectedIds, selectedProjId, loading,
    calData, weekDays, monthGrid, memberColorMap, projectFilteredMembers, visibleMembers,
    weekLabel, dayLabel, selectedDate,
    setView: setViewWrapped, toggleMember, selectAll, deselectAll, handleProjectFilter,
    goToday, goToDay, prev, next,
  };
}
