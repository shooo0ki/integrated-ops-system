// ─── マイページの型定義 ───────────────────────────────────

export interface MemberDetail {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  status: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  email: string;
  role: string;
  skills: {
    id: string;
    skillId: string;
    skillName: string;
    categoryName: string;
    level: number;
    evaluatedAt: string;
    memo: string | null;
  }[];
}

export interface TodayAttendance {
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  status: string;
}

export interface MyPageProject {
  projectId: string;
  projectName: string;
  role: string;
  workloadHours: number;
}

export interface EvalRecord {
  id: string;
  targetPeriod: string;
  scoreP: number;
  scoreA: number;
  scoreS: number;
  totalAvg: number;
  comment: string | null;
}

export interface MyPageResponse extends MemberDetail {
  projects: MyPageProject[];
}

export interface MyPageSummaryResponse {
  member: MyPageResponse;
  evaluations: EvalRecord[];
}

export interface ProfileForm {
  email: string;
  phone: string;
  address: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
}
