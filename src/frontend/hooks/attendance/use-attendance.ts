"use client";
import { toJSTDateString } from "@/shared/utils";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { useToast } from "@/frontend/hooks/use-toast";
import type { AttendanceStatus, TodayRecord } from "@/shared/types/attendance";

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

  useEffect(() => {
    if (myRecord?.todoToday) {
      setTodayPlan(myRecord.todoToday);
    } else if (prevTodoTomorrow && !todayPlan) {
      // 未出勤時: 前回退勤時の「次回やること」をプリフィル（1-1-1）
      setTodayPlan(prevTodoTomorrow);
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
  };
}
