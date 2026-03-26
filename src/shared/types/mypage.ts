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
  scores: Record<string, string | null>; // { "1-1-a": "A"|"B"|"C"|"D"|null }
  axisAverages: Record<string, number | null>;
  totalAvg: number | null;
  comment: string | null;
}

export interface MyPageResponse extends MemberDetail {
  projects: MyPageProject[];
}

export interface SkillAssessmentSummary {
  targetPeriod: string;
  scores: Record<string, string | null>;
  axisAverages: Record<string, number | null>;
  totalAvg: number | null;
}

export interface MyPageSummaryResponse {
  member: MyPageResponse;
  skillAssessment: SkillAssessmentSummary | null;
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
