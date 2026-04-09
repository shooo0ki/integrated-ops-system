"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  HOUR_PX, START_HOUR, END_HOUR, GRID_H, TIME_W, DAY_MIN_W, HOURS, COLORS, DEFAULT_SCROLL_HOUR, MIN_BLOCK_PX,
} from "@/frontend/constants/calendar";
import type { CalMember, CalData } from "@/shared/types/calendar";
import { timeToY, spanPx, nowTimeStr, nowY } from "./calendar-utils";
import { LocationBadge } from "./location-badge";

type Block = {
  memberId: string;
  memberName: string;
  top: number;
  height: number;
  type: "attendance" | "schedule";
  clockIn?: string;
  clockOut?: string | null;
  startTime?: string;
  endTime?: string | null;
  locationType: string;
  color: typeof COLORS[number];
};

type Preview = {
  memberName: string;
  type: "attendance" | "schedule";
  clockIn?: string;
  clockOut?: string | null;
  startTime?: string;
  endTime?: string | null;
  locationType: string;
  x: number;
  y: number;
};

export function DayView({ date, visible, calData }: {
  date: string;
  visible: CalMember[];
  calData: CalData;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentY, setCurrentY] = useState(nowY());
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (DEFAULT_SCROLL_HOUR - START_HOUR) * HOUR_PX;
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

  // メンバーごとの予定・実績ブロックを計算
  const memberBlocks = useMemo(() => {
    const result = new Map<string, { scheduleBlock: Block | null; attendanceBlock: Block | null }>();

    for (const member of visible) {
      const color = colorMap.get(member.id) ?? COLORS[0];
      const a = calData.attendances.find(att => att.memberId === member.id && att.date === date) ?? null;
      const s = calData.schedules.find(sch => sch.memberId === member.id && sch.date === date) ?? null;

      let scheduleBlock: Block | null = null;
      if (s && !s.isOff && s.startTime) {
        const endTime = s.endTime ?? `${END_HOUR}:00`;
        scheduleBlock = {
          memberId: member.id, memberName: member.name,
          top: timeToY(s.startTime) + 1,
          height: Math.max(MIN_BLOCK_PX, spanPx(s.startTime, endTime) - 2),
          type: "schedule", startTime: s.startTime, endTime: s.endTime,
          locationType: s.locationType, color,
        };
      }

      let attendanceBlock: Block | null = null;
      if (a?.clockIn) {
        const endTime = a.clockOut ?? nowTimeStr();
        attendanceBlock = {
          memberId: member.id, memberName: member.name,
          top: timeToY(a.clockIn) + 1,
          height: Math.max(MIN_BLOCK_PX, spanPx(a.clockIn, endTime) - 2),
          type: "attendance", clockIn: a.clockIn, clockOut: a.clockOut,
          locationType: a.locationType, color,
        };
      }

      result.set(member.id, { scheduleBlock, attendanceBlock });
    }
    return result;
  }, [visible, calData, date, colorMap, currentY]);

  const handleBlockClick = useCallback((block: Block, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreview({
      memberName: block.memberName, type: block.type,
      clockIn: block.clockIn, clockOut: block.clockOut,
      startTime: block.startTime, endTime: block.endTime,
      locationType: block.locationType,
      x: rect.left + rect.width / 2, y: rect.top,
    });
  }, []);

  useEffect(() => {
    if (!preview) return;
    const close = () => setPreview(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [preview]);

  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden relative">
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight: 14 * HOUR_PX + 60 }}
      >
        <div style={{ minWidth: TIME_W + DAY_MIN_W * Math.max(visible.length, 1) }}>

          {/* メンバーヘッダー */}
          <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20 shadow-sm">
            <div style={{ width: TIME_W, minWidth: TIME_W }} className="border-r border-slate-100 shrink-0" />
            {visible.map(member => {
              const color = colorMap.get(member.id) ?? COLORS[0];
              return (
                <div key={member.id}
                  className="flex-1 py-2.5 text-center border-r border-slate-100 last:border-r-0"
                  style={{ minWidth: DAY_MIN_W }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                    <span className={`text-sm font-semibold ${color.text}`}>{member.name}</span>
                  </div>
                </div>
              );
            })}
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

            {/* メンバー列 */}
            {visible.map(member => {
              const blocks = memberBlocks.get(member.id);
              return (
                <div key={member.id}
                  className="flex-1 border-r border-slate-100 last:border-r-0 relative"
                  style={{ minWidth: DAY_MIN_W }}
                >
                  <div className="relative" style={{ height: GRID_H }}>
                    {HOURS.map(h => (
                      <div key={h} className="absolute inset-x-0 border-t border-slate-100"
                        style={{ top: (h - START_HOUR) * HOUR_PX }} />
                    ))}
                    {HOURS.map(h => (
                      <div key={`${h}h`} className="absolute inset-x-0 border-t border-slate-50"
                        style={{ top: (h - START_HOUR) * HOUR_PX + HOUR_PX / 2 }} />
                    ))}

                    {/* 現在時刻インジケータ */}
                    {isToday && currentY >= 0 && currentY <= GRID_H && (
                      <div className="absolute inset-x-0 z-10 flex items-center pointer-events-none" style={{ top: currentY }}>
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
                        <div className="flex-1 h-px bg-red-400" />
                      </div>
                    )}

                    {/* 勤務予定（背景） */}
                    {blocks?.scheduleBlock && (
                      <div
                        className="absolute rounded-md border-l-2 border-dashed overflow-hidden cursor-pointer hover:brightness-95 transition-[filter] outline-none opacity-30"
                        style={{
                          top: blocks.scheduleBlock.top,
                          height: blocks.scheduleBlock.height,
                          left: "2%", width: "96%",
                          padding: "2px 4px", zIndex: 1,
                          backgroundColor: `${blocks.scheduleBlock.color.hex}30`,
                          borderLeftColor: blocks.scheduleBlock.color.hex,
                        }}
                        onClick={(e) => handleBlockClick(blocks.scheduleBlock!, e)}
                      >
                        <p className="text-xs font-semibold truncate leading-tight" style={{ color: blocks.scheduleBlock.color.darkHex }}>
                          予定
                        </p>
                        {blocks.scheduleBlock.height >= 32 && (
                          <p className="text-xs truncate leading-tight opacity-80" style={{ color: blocks.scheduleBlock.color.darkHex }}>
                            {blocks.scheduleBlock.startTime}〜{blocks.scheduleBlock.endTime ?? ""}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 勤怠実績（前面） */}
                    {blocks?.attendanceBlock && (() => {
                      const block = blocks.attendanceBlock!;
                      const isWorking = block.clockOut === null;
                      return (
                        <div
                          className="absolute rounded-md border-l-2 overflow-hidden cursor-pointer hover:brightness-95 transition-[filter] outline-none"
                          style={{
                            top: block.top,
                            height: block.height,
                            left: "2%", width: "96%",
                            padding: "2px 4px", zIndex: 2,
                            backgroundColor: `${block.color.hex}99`,
                            borderLeftColor: block.color.hex,
                          }}
                          onClick={(e) => handleBlockClick(block, e)}
                        >
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-semibold truncate leading-tight" style={{ color: block.color.darkHex }}>
                              実績
                            </p>
                            {isWorking && (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                            )}
                          </div>
                          {block.height >= 32 && (
                            <p className="text-xs truncate leading-tight opacity-80" style={{ color: block.color.darkHex }}>
                              {block.clockIn}〜{block.clockOut ?? "勤務中"}
                            </p>
                          )}
                          {block.height >= 48 && (
                            <LocationBadge locationType={block.locationType} />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* プレビューポップオーバー */}
      {preview && (
        <div
          className="fixed z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm"
          style={{
            left: Math.min(preview.x - 100, typeof window !== "undefined" ? window.innerWidth - 240 : 0),
            top: Math.max(preview.y - 110, 8),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-bold text-slate-800 mb-1">{preview.memberName}</p>
          <div className="space-y-0.5 text-slate-600">
            {preview.type === "attendance" ? (
              <>
                <p>出勤: {preview.clockIn}</p>
                <p>退勤: {preview.clockOut ?? "勤務中"}</p>
              </>
            ) : (
              <p>予定: {preview.startTime}〜{preview.endTime ?? ""}</p>
            )}
            <p>勤務形態: <LocationBadge locationType={preview.locationType} /></p>
          </div>
        </div>
      )}
    </div>
  );
}
