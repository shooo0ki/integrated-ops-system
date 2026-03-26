import type { ScoreGrade } from "@/shared/constants/evaluation-taxonomy";

const GRADE_BG: Record<string, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-slate-100 text-slate-700",
  D: "bg-red-100 text-red-700",
};

export function GradeBadge({ grade }: { grade: ScoreGrade | null }) {
  if (grade == null) {
    return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-50 text-slate-400">N/A</span>;
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${GRADE_BG[grade] ?? ""}`}>
      {grade}
    </span>
  );
}

export function AvgBadge({ avg }: { avg: number | null }) {
  if (avg == null) return <span className="text-xs text-slate-400">—</span>;
  const color =
    avg >= 3.5 ? "text-green-700" :
    avg >= 2.5 ? "text-blue-700" :
    avg >= 1.5 ? "text-slate-700" :
    "text-red-700";
  return <span className={`text-sm font-semibold ${color}`}>{avg.toFixed(2)}</span>;
}
