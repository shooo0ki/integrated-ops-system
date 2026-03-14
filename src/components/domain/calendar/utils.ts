import { HOUR_PX, START_HOUR, END_HOUR, DOW_JP } from "@/constants/calendar";

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeHour(h: number): number {
  return h < START_HOUR ? h + 24 : h;
}

export function timeToY(t: string): number {
  const [hRaw, m] = t.split(":").map(Number);
  const h = normalizeHour(hRaw);
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, h * 60 + m));
  return ((clamped - START_HOUR * 60) / 60) * HOUR_PX;
}

export function spanPx(start: string, end: string): number {
  const [h1r, m1] = start.split(":").map(Number);
  const [h2r, m2] = end.split(":").map(Number);
  let h1 = normalizeHour(h1r);
  let h2 = normalizeHour(h2r);
  if (h2 <= h1) h2 += 24;
  const s = Math.max(START_HOUR * 60, h1 * 60 + m1);
  const e = Math.min(END_HOUR * 60, h2 * 60 + m2);
  return Math.max(HOUR_PX / 4, ((e - s) / 60) * HOUR_PX);
}

export function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export function nowY() {
  const n = new Date();
  const h = normalizeHour(n.getHours());
  return ((h * 60 + n.getMinutes() - START_HOUR * 60) / 60) * HOUR_PX;
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
