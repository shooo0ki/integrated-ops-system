// ─── スキルマトリクスの型定義 ─────────────────────────────

export interface SkillItem {
  id: string;
  name: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  skills: SkillItem[];
}

export interface MemberRow {
  id: string;
  name: string;
  role: string;
}

export interface MatrixData {
  categories: SkillCategory[];
  members: MemberRow[];
  levelMap: Record<string, Record<string, number>>;
}
