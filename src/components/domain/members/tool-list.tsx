import { Wrench } from "lucide-react";
import { type MemberTool } from "@/lib/mock-data";

interface ToolListProps {
  tools: MemberTool[];
}

const proficiencyColor: Record<string, string> = {
  初級: "bg-slate-100 text-slate-600",
  中級: "bg-blue-100 text-blue-700",
  上級: "bg-green-100 text-green-700",
};

export function ToolList({ tools }: ToolListProps) {
  const byCategory = tools.reduce<Record<string, MemberTool[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
        <Wrench size={16} /> 使用ツール
      </h3>
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</p>
          <div className="flex flex-wrap gap-2">
            {items.map((tool) => (
              <div
                key={tool.toolId}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1"
              >
                <span className="text-sm text-slate-700">{tool.toolName}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${proficiencyColor[tool.proficiency]}`}>
                  {tool.proficiency}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {tools.length === 0 && (
        <p className="text-sm text-slate-500">ツールデータがありません。</p>
      )}
    </div>
  );
}
