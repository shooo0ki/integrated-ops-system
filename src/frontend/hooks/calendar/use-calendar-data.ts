"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { COLORS } from "@/frontend/constants/calendar";
import type { CalData, ViewMode } from "@/shared/types/calendar";
import { localDateStr, buildWeekDays, buildMonthGrid } from "@/frontend/components/domain/calendar/utils";

export function useCalendarData() {
  const { memberId: myMemberId, role } = useAuth();
  const isAdmin = role === "admin" || role === "manager";
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [displayYear, setDisplayYear] = useState(0);
  const [displayMonth, setDisplayMonth] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [selectedProjId, setSelectedProjId] = useState<string>("");
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = new Date();
    setToday(localDateStr(now));
    setAnchor(now);
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth() + 1);
  }, []);

  const weekDays = useMemo(() => anchor && today ? buildWeekDays(anchor, today) : [], [anchor, today]);
  const monthGrid = useMemo(() => displayYear && today ? buildMonthGrid(displayYear, displayMonth, today) : [], [displayYear, displayMonth, today]);

  const from = view === "week" ? weekDays[0]?.date : monthGrid[0]?.[0]?.date;
  const to = view === "week" ? weekDays[6]?.date : monthGrid[monthGrid.length - 1]?.[6]?.date;

  const calUrl = from && to ? `/api/calendar?from=${from}&to=${to}` : null;

  const { data: calData = { members: [], schedules: [], attendances: [], projects: [] }, isLoading: loading } = useSWR<CalData>(
    calUrl,
    { keepPreviousData: true },
  );

  const memberColorMap = useMemo(
    () => new Map(calData.members.map((m, i) => [m.id, COLORS[i % COLORS.length]])),
    [calData.members]
  );

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

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth() + 1);
  }

  function prev() {
    if (view === "week") {
      if (!anchor) return;
      const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d);
    } else {
      let m = displayMonth - 1, y = displayYear;
      if (m < 1) { m = 12; y--; }
      setDisplayMonth(m); setDisplayYear(y);
    }
  }

  function next() {
    if (view === "week") {
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

  return {
    view, anchor, displayYear, displayMonth, selectedIds, selectedProjId, loading,
    calData, weekDays, monthGrid, memberColorMap, projectFilteredMembers, visibleMembers, weekLabel,
    setView, toggleMember, selectAll, deselectAll, handleProjectFilter, goToday, prev, next,
  };
}
