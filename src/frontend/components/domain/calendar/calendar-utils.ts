import { HOUR_PX, START_HOUR, END_HOUR, DOW_JP, COLORS } from "@/frontend/constants/calendar";

// ─── 共通型定義 ─────────────────────────────────────────

export type CalBlock = {
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

export type CalPreview = {
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

// ─── ユーティリティ関数 ─────────────────────────────────

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "HH:MM" → 0時からの経過分 */
export function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function timeToY(t: string): number {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, timeToMin(t)));
  return ((clamped - START_HOUR * 60) / 60) * HOUR_PX;
}

export function spanPx(start: string, end: string): number {
  const startMin = timeToMin(start);
  let endMin = timeToMin(end);
  // 日跨ぎ判定: 分単位で比較（同一時刻や短時間の差を24h扱いしない）
  if (endMin < startMin) endMin += 24 * 60;
  const s = Math.max(START_HOUR * 60, startMin);
  const e = Math.min(END_HOUR * 60, endMin);
  return Math.max(HOUR_PX / 4, ((e - s) / 60) * HOUR_PX);
}

export function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export function nowY() {
  return timeToY(nowTimeStr());
}

export type WeekDay = {
  date: string;
  dayLabel: string;
  dayNum: number;
  isWeekend: boolean;
  isToday: boolean;
};

export function buildWeekDays(anchor: Date, today: string): WeekDay[] {
  const dow = anchor.getDay();
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() + (dow === 0 ? -6 : 1 - dow));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds = localDateStr(d);
    return {
      date: ds,
      dayLabel: DOW_JP[d.getDay()],
      dayNum: d.getDate(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: ds === today,
    };
  });
}

export type MonthDay = {
  date: string;
  dayNum: number;
  dayLabel: string;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
};

export function buildMonthGrid(year: number, month: number, today: string): MonthDay[][] {
  const first = new Date(year, month - 1, 1);
  const offset = first.getDay() === 0 ? -6 : 1 - first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() + offset);
  const cur = new Date(start);
  const weeks: MonthDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: MonthDay[] = [];
    for (let d = 0; d < 7; d++) {
      const ds = localDateStr(cur);
      week.push({
        date: ds,
        dayNum: cur.getDate(),
        dayLabel: DOW_JP[cur.getDay()],
        isCurrentMonth: cur.getMonth() === month - 1,
        isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
        isToday: ds === today,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur.getMonth() !== month - 1 && w >= 4) break;
  }
  return weeks;
}
