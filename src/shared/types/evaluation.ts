// ─── 人事評価の型定義（5軸） ─────────────────────────────────

import type { EvalScores } from "@/shared/constants/evaluation-taxonomy";

/** 管理者一覧テーブル用の行 */
export type EvalRow = {
  memberId: string;
  memberName: string;
  evaluated: boolean;
  id?: string;
  targetPeriod?: string;
  scores?: EvalScores;
  axisAverages?: Record<string, number | null>; // { engineering: 3.5, biz: null, ... }
  totalAvg?: number | null;
  comment?: string;
  updatedAt?: string;
};

/** 一般ユーザー自分の評価 */
export type OwnEval = {
  id: string;
  memberId: string;
  targetPeriod: string;
  scores: EvalScores;
  axisAverages: Record<string, number | null>;
  totalAvg: number | null;
  comment?: string;
  updatedAt: string;
} | null;
