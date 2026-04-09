// ─── 勤怠管理の型定義 ─────────────────────────────────────

export type AttendanceStatus = "not_started" | "working" | "break" | "done" | "absent";

export interface TodayRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  actualHours: number | null;
  todoToday: string | null;
  doneToday: string | null;
  todoTomorrow: string | null;
  status: AttendanceStatus;
  prevTodoTomorrow?: string | null;
}

export interface CorrectionRecord {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  actualHours: number | null;
  confirmStatus: string;
}
