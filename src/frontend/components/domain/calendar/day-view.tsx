"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  HOUR_PX, START_HOUR, END_HOUR, GRID_H, TIME_W, DAY_MIN_W, HOURS, COLORS, DEFAULT_SCROLL_HOUR, MIN_BLOCK_PX,
} from "@/frontend/constants/calendar";
import type { CalMember, CalData } from "@/shared/types/calendar";
import type { CalBlock, CalPreview } from "./calendar-utils";
import { timeToY, spanPx, nowTimeStr, nowY } from "./calendar-utils";
import { useCalendarMaps } from "@/frontend/hooks/calendar/use-calendar-maps";
import { LocationBadge } from "./location-badge";

type Block = Omit<CalBlock, "startMin" | "endMin">;
type Preview = CalPreview;

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

  const { colorMap } = useCalendarMaps(calData);

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

                    {/* 予定＋実績を統合レンダリング */}
                    {(() => {
                      const sched = blocks?.scheduleBlock;
                      const att = blocks?.attendanceBlock;
                      if (!sched && !att) return null;
                      const color = (att ?? sched)!.color;

                      // 予定のみ（実績なし）
                      if (sched && !att) {
                        return (
                          <div
                            className="absolute rounded-md border border-dashed overflow-hidden cursor-pointer hover:brightness-95 transition-[filter] outline-none"
                            style={{
                              top: sched.top, height: sched.height,
                              left: "2%", width: "96%",
                              padding: "2px 4px", zIndex: 1,
                              backgroundColor: `${color.hex}18`,
                              borderColor: `${color.hex}60`,
                            }}
                            onClick={(e) => handleBlockClick(sched, e)}
                          >
                            <p className="text-xs font-semibold truncate leading-tight" style={{ color: color.darkHex, opacity: 0.6 }}>
                              予定
                            </p>
                            {sched.height >= 32 && (
                              <p className="text-xs truncate leading-tight" style={{ color: color.darkHex, opacity: 0.4 }}>
                                {sched.startTime}〜{sched.endTime ?? ""}
                              </p>
                            )}
                          </div>
                        );
                      }

                      // 実績あり
                      if (att) {
                        const isWorking = att.clockOut === null;
                        const containerTop = sched ? Math.min(sched.top, att.top) : att.top;
                        const containerBottom = sched
                          ? Math.max(sched.top + sched.height, att.top + att.height)
                          : att.top + att.height;
                        const containerHeight = containerBottom - containerTop;
                        const schedEndY = sched ? (sched.top + sched.height - containerTop) : null;

                        return (
                          <div
                            className="absolute overflow-visible"
                            style={{
                              top: containerTop, height: containerHeight,
                              left: "2%", width: "96%", zIndex: 2,
                            }}
                          >
                            {/* 予定枠 */}
                            {sched && (
                              <div
                                className="absolute rounded-md border border-dashed pointer-events-none"
                                style={{
                                  top: sched.top - containerTop, height: sched.height,
                                  left: 0, right: 0,
                                  backgroundColor: `${color.hex}10`,
                                  borderColor: `${color.hex}40`,
                                }}
                              />
                            )}

                            {/* 実績 */}
                            <div
                              className="absolute rounded-md border-l-[3px] overflow-hidden cursor-pointer hover:brightness-95 transition-[filter] outline-none"
                              style={{
                                top: att.top - containerTop, height: att.height,
                                left: 0, right: 0,
                                padding: "2px 4px",
                                backgroundColor: `${color.hex}55`,
                                borderLeftColor: color.hex,
                              }}
                              onClick={(e) => handleBlockClick(att, e)}
                            >
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-semibold truncate leading-tight" style={{ color: color.darkHex }}>
                                  {att.memberName}
                                </p>
                                {isWorking && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                                )}
                              </div>
                              {att.height >= 32 && (
                                <p className="text-xs truncate leading-tight opacity-80" style={{ color: color.darkHex }}>
                                  {att.clockIn}〜{att.clockOut ?? "勤務中"}
                                </p>
                              )}
                              {att.height >= 48 && (
                                <LocationBadge locationType={att.locationType} />
                              )}
                            </div>

                            {/* 予定終了ライン */}
                            {schedEndY != null && isWorking && schedEndY > 0 && schedEndY < containerHeight && (
                              <div className="absolute inset-x-1 pointer-events-none" style={{ top: schedEndY }}>
                                <div className="h-px border-t border-dashed" style={{ borderColor: color.darkHex, opacity: 0.5 }} />
                                <span className="absolute right-0 -top-3 text-[9px] whitespace-nowrap" style={{ color: color.darkHex, opacity: 0.5 }}>
                                  〜{sched!.endTime}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
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
            left: Math.min(preview.x - 100, window.innerWidth - 240),
            top: Math.max(preview.y - 110, 8),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-bold text-slate-800 mb-1">{preview.memberName}</p>
          <div className="space-y-0.5 text-slate-600">
            {preview.type === "attendance" && (
              <p className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#3b82f6" }} />
                実績: {preview.clockIn}〜{preview.clockOut ?? <span className="text-green-600 font-medium">勤務中</span>}
              </p>
            )}
            {preview.type === "schedule" && (
              <p className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm border border-dashed border-slate-400 shrink-0" />
                予定: {preview.startTime}〜{preview.endTime ?? ""}
              </p>
            )}
            <p>勤務形態: <LocationBadge locationType={preview.locationType} /></p>
          </div>
        </div>
      )}
    </div>
  );
}
