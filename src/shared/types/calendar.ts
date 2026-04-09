// ─── カレンダーの型定義 ───────────────────────────────────

export interface CalMember {
  id: string;
  name: string;
  projectIds: string[];
}

export interface CalProject {
  id: string;
  name: string;
}

export interface SchedEntry {
  memberId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isOff: boolean;
  locationType: string;
}

export interface AttEntry {
  memberId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  confirmStatus: string;
  locationType: string;
}

export interface CalData {
  members: CalMember[];
  schedules: SchedEntry[];
  attendances: AttEntry[];
  projects: CalProject[];
}

export type ViewMode = "week" | "month" | "day";
