"use client";
import { toJSTDateString } from "@/shared/utils";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { useToast } from "@/frontend/hooks/use-toast";
import type { AttendanceStatus, TodayRecord, CorrectionRecord } from "@/shared/types/attendance";

export function useAttendance() {
  const { memberId, role } = useAuth();
  const isAdmin = role === "admin" || role === "manager";

  const [todayStr, setTodayStr] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  useEffect(() => {
    const now = new Date();
    setTodayStr(toJSTDateString(now));
    setTodayLabel(now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "long" }));
  }, []);

  const { data: myRecord = null, mutate: mutateToday } = useSWR<TodayRecord | null>("/api/attendances/today");
  const myStatus: AttendanceStatus = myRecord?.status ?? "not_started";
  const { data: correctionsData = [], mutate: mutateCorrections } = useSWR<CorrectionRecord[]>(
    isAdmin ? "/api/attendances/corrections" : null
  );
  const corrections = Array.isArray(correctionsData) ? correctionsData : [];
  const [approvingId, setApprovingId] = useState<string | null>(null);
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

  useEffect(() => {
    if (myRecord?.todoToday) setTodayPlan(myRecord.todoToday);
  }, [myRecord]);

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
      const res = await fetch("/api/attendances/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: myRecord?.date ?? todayStr,
          doneToday: todayDone,
          todoTomorrow: tomorrowPlan,
          breakMinutes: Number(breakMinutes),
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
    if (!todayDone.trim()) { setClockInError("今日やったことを入力してください"); return false; }
    if (!tomorrowPlan.trim()) { setClockInError("次回勤務日にやることを入力してください"); return false; }
    setClockInError("");
    return true;
  }

  async function handleApprove(id: string) {
    setApprovingId(id);
    mutateCorrections(corrections.filter((c) => c.id !== id), { revalidate: false });
    const res = await fetch(`/api/attendances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmStatus: "confirmed" }),
    });
    if (res.ok) {
      toast.show("修正を承認しました");
    }
    await mutateCorrections();
    setApprovingId(null);
  }

  return {
    memberId, isAdmin,
    todayStr, todayLabel,
    myRecord, myStatus, corrections,
    workLocation, setWorkLocation,
    todayPlan, setTodayPlan, todayDone, setTodayDone,
    tomorrowPlan, setTomorrowPlan, breakMinutes, setBreakMinutes,
    clockInError, clockingIn, clockingOut, actionLog,
    approvingId, toast,
    clockIn, clockOut, validateClockOut, handleApprove,
  };
}
