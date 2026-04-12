"use client";
import { toJSTDateString } from "@/shared/utils";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { useToast } from "@/frontend/hooks/use-toast";
import type { AttendanceStatus, TodayRecord, WorkLogEntry } from "@/shared/types/attendance";

export interface WorkLogRow {
  projectId: string;
  hours: number;
  note: string;
}

export function useAttendance() {
  const { memberId } = useAuth();

  const [todayStr, setTodayStr] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  useEffect(() => {
    const now = new Date();
    setTodayStr(toJSTDateString(now));
    setTodayLabel(now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "long" }));
  }, []);

  const { data: rawToday = null, mutate: mutateToday } = useSWR<TodayRecord | { prevTodoTomorrow: string | null } | null>("/api/attendances/today");
  // API が { prevTodoTomorrow } のみ返す場合（未出勤）は myRecord = null として扱う
  const myRecord: TodayRecord | null = rawToday && "id" in rawToday ? rawToday : null;
  const prevTodoTomorrow = rawToday && "prevTodoTomorrow" in rawToday ? rawToday.prevTodoTomorrow : null;
  const myStatus: AttendanceStatus = myRecord?.status ?? "not_started";
  const toast = useToast();

  const [workLocation, setWorkLocation] = useState<"オフィス" | "オンライン" | "">("");
  const locationTypeMap: Record<string, string> = { "オフィス": "office", "オンライン": "online" };
  const [todayPlan, setTodayPlan] = useState("");
  const [todayDone, setTodayDone] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [clockInError, setClockInError] = useState("");
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);

  // workLogs (PJ + 工数)
  const [workLogs, setWorkLogs] = useState<WorkLogRow[]>([]);
  const { data: myProjects } = useSWR<{ id: string; name: string }[]>("/api/attendances/my-projects");

  const addWorkLog = useCallback(() => {
    setWorkLogs((prev) => [...prev, { projectId: "", hours: 0, note: "" }]);
  }, []);
  const removeWorkLog = useCallback((idx: number) => {
    setWorkLogs((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const updateWorkLog = useCallback((idx: number, field: keyof WorkLogRow, value: string | number) => {
    setWorkLogs((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  useEffect(() => {
    if (myRecord?.todoToday) {
      setTodayPlan(myRecord.todoToday);
    } else if (prevTodoTomorrow && !todayPlan) {
      setTodayPlan(prevTodoTomorrow);
    }
    // 既存 workLogs をプリフィル
    if (myRecord?.workLogs && myRecord.workLogs.length > 0 && workLogs.length === 0) {
      setWorkLogs(myRecord.workLogs.map((l: WorkLogEntry) => ({
        projectId: l.projectId,
        hours: l.hours,
        note: l.note ?? "",
      })));
    }
  }, [myRecord, prevTodoTomorrow]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeStr = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  async function clockIn() {
    if (!workLocation) { setClockInError("勤務場所を選択してください"); return; }
    if (!todayPlan.trim()) { setClockInError("今日やることを入力してください"); return; }
    setClockInError("");
    setClockingIn(true);
    const now = timeStr();
    mutateToday(
      { id: "temp", date: todayStr, clockIn: now, clockOut: null, breakMinutes: 0, actualHours: null, todoToday: todayPlan, doneToday: null, todoTomorrow: null, status: "working" },
      { revalidate: false }
    );
    try {
      const res = await fetch("/api/attendances/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr, todoToday: todayPlan, locationType: locationTypeMap[workLocation] ?? "office" }),
      });
      if (res.ok) {
        setActionLog((prev) => [`${now} 出勤しました（${workLocation}）`, ...prev]);
      }
      await mutateToday();
    } finally {
      setClockingIn(false);
    }
  }

  async function clockOut() {
    setClockingOut(true);
    const now = timeStr();
    if (myRecord) {
      mutateToday({ ...myRecord, status: "done", clockOut: now }, { revalidate: false });
    }
    try {
      const validLogs = workLogs.filter((l) => l.projectId && l.hours > 0);
      const res = await fetch("/api/attendances/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: myRecord?.date ?? todayStr,
          doneToday: todayDone,
          todoTomorrow: tomorrowPlan,
          breakMinutes: Number(breakMinutes),
          workLogs: validLogs.map((l) => ({ projectId: l.projectId, hours: l.hours, note: l.note || undefined })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const hours = data.workMinutes != null ? (data.workMinutes / 60).toFixed(1) : "—";
        setActionLog((prev) => [`${now} 退勤しました（実働 ${hours}h）`, ...prev]);
      }
      await mutateToday();
    } finally {
      setClockingOut(false);
    }
  }

  function validateClockOut(): boolean {
    const validLogs = workLogs.filter((l) => l.projectId && l.hours > 0);
    if (validLogs.length === 0) { setClockInError("工数を1件以上入力してください"); return false; }
    if (!tomorrowPlan.trim()) { setClockInError("次回勤務日にやることを入力してください"); return false; }
    setClockInError("");
    return true;
  }

  return {
    memberId,
    todayStr, todayLabel,
    myRecord, myStatus,
    workLocation, setWorkLocation,
    todayPlan, setTodayPlan, todayDone, setTodayDone,
    tomorrowPlan, setTomorrowPlan, breakMinutes, setBreakMinutes,
    clockInError, clockingIn, clockingOut, actionLog,
    toast,
    clockIn, clockOut, validateClockOut,
    // workLogs (1-1-2, 1-1-3, 1-1-5)
    workLogs, myProjects: myProjects ?? [],
    addWorkLog, removeWorkLog, updateWorkLog,
  };
}
