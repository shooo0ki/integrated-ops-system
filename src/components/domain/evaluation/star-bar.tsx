export function StarBar({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= score ? "text-amber-400" : "text-slate-200"}>★</span>
      ))}
    </div>
  );
}

export function ScoreBadge({ score, label }: { score: number; label: string }) {
  const colors = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-slate-100 text-slate-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colors[score] ?? ""}`}>
      {score}点 {label}
    </span>
  );
}
