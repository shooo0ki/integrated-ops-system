"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import {
  HOUR_PX, START_HOUR, END_HOUR, GRID_H, TIME_W, DAY_MIN_W, HOURS, COLORS,
} from "@/frontend/constants/calendar";
import type { CalMember, CalData, AttEntry, SchedEntry } from "@/shared/types/calendar";
import type { WeekDay } from "./calendar-utils";
import { timeToY, spanPx, nowTimeStr, nowY } from "./calendar-utils";
import { LocationBadge } from "./location-badge";

export function WeekView({ weekDays, visible, calData }: {
  weekDays: WeekDay[];
  visible: CalMember[];
  calData: CalData;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentY, setCurrentY] = useState(nowY());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, nowY() - 120);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentY(nowY()), 60_000);
    return () => clearInterval(t);
  }, []);

  const colorMap = useMemo(
    () => new Map(calData.members.map((m, i) => [m.id, COLORS[i % COLORS.length]])),
    [calData.members]
  );
  const colPct = visible.length > 0 ? 100 / visible.length : 100;

  const attMap = useMemo(() => {
    const map = new Map<string, AttEntry>();
    for (const a of calData.attendances) {
      map.set(`${a.memberId}:${a.date}`, a);
    }
    return map;
  }, [calData.attendances]);

  const schedMap = useMemo(() => {
    const map = new Map<string, SchedEntry>();
    for (const s of calData.schedules) {
      map.set(`${s.memberId}:${s.date}`, s);
    }
    return map;
  }, [calData.schedules]);

  function att(memberId: string, date: string) {
    return attMap.get(`${memberId}:${date}`) ?? null;
  }

  function sched(memberId: string, date: string) {
    return schedMap.get(`${memberId}:${date}`) ?? null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div
        ref={scrollRef}
        className="overflow-x-auto"
      >
        <div style={{ minWidth: TIME_W + DAY_MIN_W * 7 }}>

          {/* 曜日ヘッダー */}
          <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
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

          {/* グリッド本体 */}
          <div className="flex">
            {/* 時刻列 */}
            <div
              className="shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10 select-none relative"
              style={{ width: TIME_W, minWidth: TIME_W, height: GRID_H }}
            >
              {HOURS.map(h => (
                <div key={h} className="absolute w-full" style={{ top: (h - START_HOUR) * HOUR_PX - 8, left: 0 }}>
                  <span className="block pr-2 text-right text-xs leading-none text-slate-400">
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
                    <div key={h} className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: (h - START_HOUR) * HOUR_PX }} />
                  ))}
                  {HOURS.map(h => (
                    <div key={`${h}h`} className="absolute inset-x-0 border-t border-slate-50" style={{ top: (h - START_HOUR) * HOUR_PX + HOUR_PX / 2 }} />
                  ))}

                  {day.isToday && currentY >= 0 && currentY <= GRID_H && (
                    <div className="absolute inset-x-0 z-10 flex items-center pointer-events-none" style={{ top: currentY }}>
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
                      <div className="flex-1 h-px bg-red-400" />
                    </div>
                  )}

                  {!day.isWeekend && visible.map((member, mi) => {
                    const color = colorMap.get(member.id) ?? COLORS[0];
                    const a = att(member.id, day.date);
                    const s = sched(member.id, day.date);
                    const left = `${mi * colPct + 0.5}%`;
                    const width = `${colPct - 1}%`;

                    return (
                      <div key={member.id}>
                        {/* 予定ブロック（実績がない場合のみ） */}
                        {s && !s.isOff && s.startTime && !a?.clockIn && (
                          <div
                            className={`absolute rounded-md border-l-2 overflow-hidden opacity-60 ${color.bg} ${color.bl}`}
                            style={{
                              top: timeToY(s.startTime) + 1,
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
                              top: timeToY(a.clockIn) + 1,
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
    </div>
  );
}
