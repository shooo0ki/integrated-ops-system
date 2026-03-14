import { type MemberSkill } from "@/lib/mock-data";

interface SkillSummaryProps {
  skills: MemberSkill[];
}

const levelLabels = ["", "★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];
const levelColors = ["", "text-slate-400", "text-blue-400", "text-blue-500", "text-blue-600", "text-blue-700"];

export function SkillSummary({ skills }: SkillSummaryProps) {
  const byCategory = skills.reduce<Record<string, MemberSkill[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-slate-800">スキル</h3>
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</p>
          <div className="space-y-1">
            {items.map((skill) => (
              <div key={skill.skillId} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5">
                <span className="text-sm text-slate-700">{skill.skillName}</span>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-slate-400">評価</p>
                    <p className={`text-sm ${levelColors[skill.level]}`}>{levelLabels[skill.level]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">自己</p>
                    <p className={`text-sm ${levelColors[skill.selfEval]}`}>{levelLabels[skill.selfEval]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {skills.length === 0 && (
        <p className="text-sm text-slate-500">スキルデータがありません。</p>
      )}
    </div>
  );
}
