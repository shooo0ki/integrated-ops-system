// ─── 人材評価基準 5軸タクソノミー ─────────────────────────────
// スコア: A=4(卓越), B=3(期待以上), C=2(期待通り), D=1(要改善), null=N/A

export type ScoreGrade = "A" | "B" | "C" | "D";
export const GRADE_VALUES: Record<ScoreGrade, number> = { A: 4, B: 3, C: 2, D: 1 };
export const GRADE_LABELS: Record<ScoreGrade, string> = { A: "卓越", B: "期待以上", C: "期待通り", D: "要改善" };
export const GRADES: ScoreGrade[] = ["A", "B", "C", "D"];

export interface SubItem {
  id: string;       // e.g. "1-1-a"
  label: string;
}

export interface SubCategory {
  id: string;       // e.g. "1-1"
  label: string;
  items: SubItem[];
}

export interface Axis {
  id: number;       // 1..5
  key: string;      // "engineering" | "biz" | "communication" | "professional" | "productivity"
  label: string;
  subCategories: SubCategory[];
}

export const EVALUATION_AXES: Axis[] = [
  // ─── 1. Engineering ───
  {
    id: 1,
    key: "engineering",
    label: "Engineering Skill（技術力）",
    subCategories: [
      {
        id: "1-1",
        label: "ソフトウェアエンジニアリング（SWE）",
        items: [
          { id: "1-1-a", label: "コード品質" },
          { id: "1-1-b", label: "設計・アーキテクチャ" },
          { id: "1-1-c", label: "テスト・品質保証" },
          { id: "1-1-d", label: "リリース・運用" },
        ],
      },
      {
        id: "1-2",
        label: "データサイエンス（DS）",
        items: [
          { id: "1-2-a", label: "データ前処理・品質管理" },
          { id: "1-2-b", label: "分析・モデリング" },
          { id: "1-2-c", label: "ビジネス示唆への翻訳" },
          { id: "1-2-d", label: "MLOps・本番運用" },
        ],
      },
    ],
  },

  // ─── 2. Biz ───
  {
    id: 2,
    key: "biz",
    label: "Biz Skill（ビジネス力）",
    subCategories: [
      {
        id: "2-1",
        label: "営業（セールス）",
        items: [
          { id: "2-1-a", label: "課題発見" },
          { id: "2-1-b", label: "ソリューション創出" },
          { id: "2-1-c", label: "資料作成" },
          { id: "2-1-d", label: "顧客折衝" },
        ],
      },
      {
        id: "2-2",
        label: "デリバリー PM/EM",
        items: [
          { id: "2-2-a", label: "期待値コントロール" },
          { id: "2-2-b", label: "品質管理" },
          { id: "2-2-c", label: "納期・工数管理" },
          { id: "2-2-d", label: "リスク予見・管理" },
        ],
      },
    ],
  },

  // ─── 3. Communication ───
  {
    id: 3,
    key: "communication",
    label: "Communication（コミュニケーション力）",
    subCategories: [
      {
        id: "3-1",
        label: "対上司コミュニケーション",
        items: [
          { id: "3-1-a", label: "報告・連絡の適時性" },
          { id: "3-1-b", label: "論点整理・構造化" },
          { id: "3-1-c", label: "相談・提案" },
        ],
      },
      {
        id: "3-2",
        label: "チーム連携",
        items: [
          { id: "3-2-a", label: "情報共有" },
          { id: "3-2-b", label: "ファシリテーション" },
          { id: "3-2-c", label: "協働・調整" },
        ],
      },
    ],
  },

  // ─── 4. Professional ───
  {
    id: 4,
    key: "professional",
    label: "Professional（プロフェッショナリズム）",
    subCategories: [
      {
        id: "4-1",
        label: "判断力・意思決定",
        items: [
          { id: "4-1-a", label: "分析力（ファクトベース思考）" },
          { id: "4-1-b", label: "理想状態の定義力" },
          { id: "4-1-c", label: "判断のスピードと精度" },
          { id: "4-1-d", label: "上位視座・代行判断" },
        ],
      },
      {
        id: "4-2",
        label: "育成・ナレッジ還元",
        items: [
          { id: "4-2-a", label: "ナレッジ体系化・移転" },
          { id: "4-2-b", label: "メンバー育成" },
        ],
      },
      {
        id: "4-3",
        label: "仕事へのコミットメント",
        items: [
          { id: "4-3-a", label: "粘り強さ・完遂力" },
          { id: "4-3-b", label: "品質へのこだわり" },
          { id: "4-3-c", label: "スピード・期限意識" },
          { id: "4-3-d", label: "働く量" },
        ],
      },
      {
        id: "4-4",
        label: "自律性・成長姿勢",
        items: [
          { id: "4-4-a", label: "当事者意識（オーナーシップ）" },
          { id: "4-4-b", label: "自己研鑽・学習" },
          { id: "4-4-c", label: "組織への主体的貢献" },
        ],
      },
    ],
  },

  // ─── 5. Productivity ───
  {
    id: 5,
    key: "productivity",
    label: "Productivity（生産性）",
    subCategories: [
      {
        id: "5-1",
        label: "効率化・AI活用",
        items: [
          { id: "5-1-a", label: "ツール・AI活用" },
          { id: "5-1-b", label: "プロセス改善" },
          { id: "5-1-c", label: "手戻り削減" },
        ],
      },
      {
        id: "5-2",
        label: "アウトプット量",
        items: [
          { id: "5-2-a", label: "成果物のスループット" },
          { id: "5-2-b", label: "同時並行処理力" },
        ],
      },
    ],
  },
];

/** 全小項目IDの一覧 (バリデーション用) */
export const ALL_ITEM_IDS: string[] = EVALUATION_AXES.flatMap((axis) =>
  axis.subCategories.flatMap((sc) => sc.items.map((item) => item.id))
);

/** scores JSON の型: { "1-1-a": "A" | "B" | "C" | "D" | null, ... } */
export type EvalScores = Record<string, ScoreGrade | null>;

/** N/Aを除いた平均を算出 */
export function calcAverage(scores: EvalScores, itemIds: string[]): number | null {
  let sum = 0;
  let count = 0;
  for (const id of itemIds) {
    const grade = scores[id];
    if (grade != null) {
      sum += GRADE_VALUES[grade];
      count++;
    }
  }
  return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
}

/** 軸ごとの平均を算出 */
export function calcAxisAverage(scores: EvalScores, axis: Axis): number | null {
  const ids = axis.subCategories.flatMap((sc) => sc.items.map((i) => i.id));
  return calcAverage(scores, ids);
}

/** 全体平均を算出 */
export function calcTotalAverage(scores: EvalScores): number | null {
  return calcAverage(scores, ALL_ITEM_IDS);
}
