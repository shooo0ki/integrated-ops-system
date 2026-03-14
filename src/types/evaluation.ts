// ─── 人事評価の型定義 ─────────────────────────────────────

export type EvalRow = {
  memberId: string;
  memberName: string;
  evaluated: boolean;
  id?: string;
  targetPeriod?: string;
  scoreP?: number; labelP?: string;
  scoreA?: number; labelA?: string;
  scoreS?: number; labelS?: string;
  totalAvg?: number;
  comment?: string;
  updatedAt?: string;
};

export type OwnEval = {
  id: string;
  memberId: string;
  targetPeriod: string;
  scoreP: number; labelP: string;
  scoreA: number; labelA: string;
  scoreS: number; labelS: string;
  totalAvg: number;
  comment?: string;
  updatedAt: string;
} | null;
