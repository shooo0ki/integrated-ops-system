import type { ScoreGrade } from "@/shared/constants/evaluation-taxonomy";

const GRADE_BG: Record<string, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

export function GradeBadge({ grade }: { grade: ScoreGrade | null }) {
  if (grade == null) {
    return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-50 text-slate-300">—</span>;
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${GRADE_BG[grade] ?? ""}`}>
      {grade}
    </span>
  );
}

/** 数値平均 → A+ / A / A- / B+ / B / B- / C+ / C / C- / D 表記 */
function avgToGradeLabel(avg: number): string {
  if (avg >= 3.7) return "A+";
  if (avg >= 3.3) return "A";
  if (avg >= 3.0) return "A-";
  if (avg >= 2.7) return "B+";
  if (avg >= 2.3) return "B";
  if (avg >= 2.0) return "B-";
  if (avg >= 1.7) return "C+";
  if (avg >= 1.3) return "C";
  if (avg >= 1.0) return "C-";
  return "D";
}

function avgColor(avg: number): string {
  if (avg >= 3.0) return "text-green-700";
  if (avg >= 2.0) return "text-blue-700";
  if (avg >= 1.0) return "text-amber-700";
  return "text-red-700";
}

export function AvgBadge({ avg }: { avg: number | null }) {
  if (avg == null) return <span className="text-xs text-slate-400">—</span>;
  return <span className={`text-sm font-semibold ${avgColor(avg)}`}>{avgToGradeLabel(avg)}</span>;
}

export { avgToGradeLabel };
