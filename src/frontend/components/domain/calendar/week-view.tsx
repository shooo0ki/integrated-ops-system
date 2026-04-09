"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  HOUR_PX, START_HOUR, END_HOUR, GRID_H, TIME_W, DAY_MIN_W, HOURS, COLORS, DEFAULT_SCROLL_HOUR, MIN_BLOCK_PX,
} from "@/frontend/constants/calendar";
import type { CalMember, CalData, AttEntry, SchedEntry } from "@/shared/types/calendar";
import type { WeekDay } from "./calendar-utils";
import { timeToMin, timeToY, spanPx, nowTimeStr, nowY } from "./calendar-utils";
import { LocationBadge } from "./location-badge";

type Block = {
  memberId: string;
  memberName: string;
  startMin: number;
  endMin: number;
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

/** 同じ日のブロック群に対して、時間が重なるブロックのみを列分割する */
function layoutBlocks(blocks: Block[]): { block: Block; col: number; totalCols: number }[] {
  if (blocks.length === 0) return [];

  // ブロックを開始時間順にソート
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);

  // 各ブロックに列番号を割り当て
  const columns: Block[][] = [];
  const blockCol = new Map<Block, number>();

  for (const block of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (lastInCol.endMin <= block.startMin) {
        columns[c].push(block);
        blockCol.set(block, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      blockCol.set(block, columns.length);
      columns.push([block]);
    }
  }

  // 各ブロックが実際に重なる最大列数を計算
  const result: { block: Block; col: number; totalCols: number }[] = [];
  for (const block of sorted) {
    const col = blockCol.get(block)!;
    // このブロックと時間が重なるブロックの列数を数える
    let maxCol = col;
    for (const other of sorted) {
      if (other.startMin < block.endMin && other.endMin > block.startMin) {
        const otherCol = blockCol.get(other)!;
        if (otherCol > maxCol) maxCol = otherCol;
      }
    }
    result.push({ block, col, totalCols: maxCol + 1 });
  }

  return result;
}

export function WeekView({ weekDays, visible, calData, onDateClick }: {
  weekDays: WeekDay[];
  visible: CalMember[];
  calData: CalData;
  onDateClick?: (dateStr: string) => void;
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

  // 日ごとのブロックを事前計算（予定と実績を分離して2層描画）
  const dayBlocks = useMemo(() => {
    const result = new Map<string, {
      scheduleBlocks: Block[];
      attendanceBlocks: Block[];
      memberColumns: Map<string, { col: number; totalCols: number }>;
    }>();

    for (const day of weekDays) {
      if (day.isWeekend) continue;
      const schedBlocks: Block[] = [];
      const attBlocks: Block[] = [];

      for (const member of visible) {
        const color = colorMap.get(member.id) ?? COLORS[0];
        const a = attMap.get(`${member.id}:${day.date}`) ?? null;
        const s = schedMap.get(`${member.id}:${day.date}`) ?? null;

        // 勤務予定は常に背景レイヤーとして表示（1-2-1 + 1-2-2）
        if (s && !s.isOff && s.startTime) {
          const endTime = s.endTime ?? `${END_HOUR}:00`;
          schedBlocks.push({
            memberId: member.id,
            memberName: member.name,
            startMin: timeToMin(s.startTime),
            endMin: timeToMin(endTime),
            top: timeToY(s.startTime) + 1,
            height: Math.max(MIN_BLOCK_PX, spanPx(s.startTime, endTime) - 2),
            type: "schedule",
            startTime: s.startTime,
            endTime: s.endTime,
            locationType: s.locationType,
            color,
          });
        }

        // 勤怠実績は前面レイヤーとして表示（1-2-6: clockOut null → nowTimeStr()）
        if (a?.clockIn) {
          const endTime = a.clockOut ?? nowTimeStr();
          attBlocks.push({
            memberId: member.id,
            memberName: member.name,
            startMin: timeToMin(a.clockIn),
            endMin: timeToMin(endTime),
            top: timeToY(a.clockIn) + 1,
            height: Math.max(MIN_BLOCK_PX, spanPx(a.clockIn, endTime) - 2),
            type: "attendance",
            clockIn: a.clockIn,
            clockOut: a.clockOut,
            locationType: a.locationType,
            color,
          });
        }
      }

      // メンバーごとの時間範囲を統合して列を割り当て（予定と実績が同じ列に来る）
      const memberSpanMap = new Map<string, { minStart: number; maxEnd: number }>();
      for (const b of [...schedBlocks, ...attBlocks]) {
        const existing = memberSpanMap.get(b.memberId);
        if (existing) {
          existing.minStart = Math.min(existing.minStart, b.startMin);
          existing.maxEnd = Math.max(existing.maxEnd, b.endMin);
        } else {
          memberSpanMap.set(b.memberId, { minStart: b.startMin, maxEnd: b.endMin });
        }
      }
      const mergedSpans: Block[] = [];
      for (const [memberId, span] of memberSpanMap) {
        const src = attBlocks.find(b => b.memberId === memberId) ?? schedBlocks.find(b => b.memberId === memberId)!;
        mergedSpans.push({ ...src, startMin: span.minStart, endMin: span.maxEnd });
      }
      const mergedLayout = layoutBlocks(mergedSpans);
      const memberColumns = new Map<string, { col: number; totalCols: number }>();
      for (const { block, col, totalCols } of mergedLayout) {
        memberColumns.set(block.memberId, { col, totalCols });
      }

      result.set(day.date, { scheduleBlocks: schedBlocks, attendanceBlocks: attBlocks, memberColumns });
    }
    return result;
    // currentY を依存に含めて出勤中ブロックを60秒ごとに再計算（1-2-6）
  }, [weekDays, visible, colorMap, attMap, schedMap, currentY]);

  const handleBlockClick = useCallback((block: Block, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreview({
      memberName: block.memberName,
      type: block.type,
      clockIn: block.clockIn,
      clockOut: block.clockOut,
      startTime: block.startTime,
      endTime: block.endTime,
      locationType: block.locationType,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  // クリックでプレビューを閉じる
  useEffect(() => {
    if (!preview) return;
    const close = () => setPreview(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [preview]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden relative">
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight: 14 * HOUR_PX + 60 }}
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
                <span
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full text-sm font-bold mx-auto px-2 ${
                    day.isToday ? "bg-blue-600 text-white" : day.isWeekend ? "text-slate-400" : "text-slate-700"
                  } ${onDateClick ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : ""}`}
                  onClick={() => onDateClick?.(day.date)}
                >
                  {day.dayNum}<span className="text-[10px] font-normal ml-0.5">({day.dayLabel})</span>
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

                  {/* 勤務予定（背景レイヤー: 薄色＋破線）(1-2-1 + 1-2-2) */}
                  {(dayBlocks.get(day.date)?.scheduleBlocks ?? []).map((block) => {
                    const { col, totalCols } = dayBlocks.get(day.date)?.memberColumns.get(block.memberId) ?? { col: 0, totalCols: 1 };
                    const widthPct = 100 / totalCols;
                    const leftPct = col * widthPct;
                    return (
                      <div
                        key={`${block.memberId}-sched`}
                        className={`absolute rounded-md border-l-2 border-dashed overflow-hidden cursor-pointer hover:brightness-95 transition-[filter] outline-none opacity-30 ${block.color.bg} ${block.color.bl}`}
                        style={{
                          top: block.top,
                          height: block.height,
                          left: `${leftPct + 0.5}%`,
                          width: `${widthPct - 1}%`,
                          padding: "2px 4px",
                          zIndex: 1,
                        }}
                        onClick={(e) => handleBlockClick(block, e)}
                      >
                        <p className={`text-xs font-semibold truncate leading-tight ${block.color.text}`}>
                          {block.memberName}
                        </p>
                        {block.height >= 32 && (
                          <p className={`text-xs truncate leading-tight ${block.color.text} opacity-80`}>
                            {block.startTime}〜{block.endTime ?? ""}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* 勤怠実績（前面レイヤー: 濃色＋実線）(1-2-1 + 1-2-2 + 1-2-6 + 1-2-7) */}
                  {(dayBlocks.get(day.date)?.attendanceBlocks ?? []).map((block) => {
                    const { col, totalCols } = dayBlocks.get(day.date)?.memberColumns.get(block.memberId) ?? { col: 0, totalCols: 1 };
                    const widthPct = 100 / totalCols;
                    const leftPct = col * widthPct;
                    const isWorking = block.clockOut === null;

                    return (
                      <div
                        key={`${block.memberId}-att`}
                        className={`absolute rounded-md border-l-2 overflow-hidden cursor-pointer hover:brightness-95 transition-[filter] outline-none ${block.color.bg} ${block.color.bl}`}
                        style={{
                          top: block.top,
                          height: block.height,
                          left: `${leftPct + 0.5}%`,
                          width: `${widthPct - 1}%`,
                          padding: "2px 4px",
                          zIndex: 2,
                        }}
                        onClick={(e) => handleBlockClick(block, e)}
                      >
                        <div className="flex items-center gap-1">
                          <p className={`text-xs font-semibold truncate leading-tight ${block.color.text}`}>
                            {block.memberName}
                          </p>
                          {isWorking && (
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                          )}
                        </div>
                        {block.height >= 32 && (
                          <p className={`text-xs truncate leading-tight ${block.color.text} opacity-80`}>
                            {block.clockIn}〜{block.clockOut ?? "勤務中"}
                          </p>
                        )}
                        {block.height >= 48 && (
                          <LocationBadge locationType={block.locationType} />
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
            {preview.type === "attendance" ? (
              <>
                <p>出勤: {preview.clockIn}</p>
                <p>退勤: {preview.clockOut ?? "勤務中"}</p>
              </>
            ) : (
              <>
                <p>予定: {preview.startTime}〜{preview.endTime ?? ""}</p>
              </>
            )}
            <p>勤務形態: <LocationBadge locationType={preview.locationType} /></p>
          </div>
        </div>
      )}
    </div>
  );
}
