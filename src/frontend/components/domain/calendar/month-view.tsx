"use client";

import { useMemo, useCallback } from "react";
import { COLORS } from "@/frontend/constants/calendar";
import type { CalMember, CalData, AttEntry, SchedEntry } from "@/shared/types/calendar";
import type { MonthDay } from "./utils";
import { LocationBadge } from "./location-badge";

const MAX_PER_CELL = 3;

export function MonthView({ grid, visible, calData }: {
  grid: MonthDay[][];
  visible: CalMember[];
  calData: CalData;
}) {
  const colorMap = useMemo(
    () => new Map(calData.members.map((m, i) => [m.id, COLORS[i % COLORS.length]])),
    [calData.members]
  );

  const attMap = useMemo(() => {
    const map = new Map<string, AttEntry>();
    for (const a of calData.attendances) map.set(`${a.memberId}:${a.date}`, a);
    return map;
  }, [calData.attendances]);

  const schedMap = useMemo(() => {
    const map = new Map<string, SchedEntry>();
    for (const s of calData.schedules) map.set(`${s.memberId}:${s.date}`, s);
    return map;
  }, [calData.schedules]);

  const getEvent = useCallback((memberId: string, date: string) => {
    const a = attMap.get(`${memberId}:${date}`);
    const s = schedMap.get(`${memberId}:${date}`);
    if (a?.clockIn) return { type: "actual" as const, clockIn: a.clockIn, clockOut: a.clockOut, locationType: a.locationType };
    if (s && !s.isOff && s.startTime) return { type: "schedule" as const, startTime: s.startTime, endTime: s.endTime, locationType: s.locationType };
    return null;
  }, [attMap, schedMap]);

  const dayItemsMap = useMemo(() => {
    const map = new Map<string, { member: CalMember; ev: NonNullable<ReturnType<typeof getEvent>> }[]>();
    for (const member of visible) {
      for (const week of grid) {
        for (const day of week) {
          const ev = getEvent(member.id, day.date);
          if (!ev) continue;
          const list = map.get(day.date) ?? [];
          list.push({ member, ev });
          map.set(day.date, list);
        }
      }
    }
    return map;
  }, [visible, grid, getEvent]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 560 }}>
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
                  className={`min-h-[80px] p-1.5 border-r border-slate-100 last:border-r-0 ${
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
                    {(() => {
                      const items = dayItemsMap.get(day.date) ?? [];
                      const overflow = Math.max(0, items.length - MAX_PER_CELL);
                      return (
                        <>
                          {items.slice(0, MAX_PER_CELL).map(({ member, ev }) => {
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
                          {overflow > 0 && (
                            <span className="pl-1 text-[10px] text-slate-400">+{overflow}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
