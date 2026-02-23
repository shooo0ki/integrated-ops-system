"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, Settings, ClipboardEdit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

interface SkillItem { id: string; name: string }
interface Category  { id: string; name: string; skills: SkillItem[] }
interface MemberRow { id: string; name: string; company: string; role: string }

interface MatrixData {
  categories: Category[];
  members: MemberRow[];
  levelMap: Record<string, Record<string, number>>;
}

// ─── スタイル ────────────────────────────────────────────

const levelStyle: Record<number, string> = {
  0: "bg-slate-100 text-slate-400",
  1: "bg-slate-200 text-slate-600",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-green-100 text-green-700",
  4: "bg-blue-100 text-blue-700",
  5: "bg-purple-100 text-purple-700 font-bold",
};
const levelBg: Record<number, string> = {
  0: "bg-slate-50", 1: "bg-slate-100", 2: "bg-yellow-50",
  3: "bg-green-50", 4: "bg-blue-50",  5: "bg-purple-50",
};
const companyDisplay = (c: string) => c === "boost" ? "Boost" : c === "salt2" ? "SALT2" : c;

function LevelCell({ level }: { level: number | null }) {
  if (level === null) {
    return <td className="border border-slate-100 px-2 py-2 text-center text-xs text-slate-300">—</td>;
  }
  return (
    <td className={`border border-slate-100 px-2 py-2 text-center text-xs ${levelBg[level]}`}>
      <span className={`inline-block rounded px-1.5 py-0.5 ${levelStyle[level]}`}>{level}</span>
    </td>
  );
}

// ─── ページ ───────────────────────────────────────────────

export default function SkillsPage() {
  const { role } = useAuth();
  const canEval = role === "admin" || role === "manager";

  const [data, setData] = useState<MatrixData | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minLevel, setMinLevel] = useState(0);

  // カテゴリ一覧（フィルタ用）は初回のみ取得
  useEffect(() => {
    fetch("/api/skill-categories")
      .then((r) => r.json())
      .then(setAllCategories)
      .catch(() => {});
  }, []);

  // マトリクスデータ（フィルタ変更ごとに再取得）
  useEffect(() => {
    const params = new URLSearchParams();
    if (companyFilter) params.set("company", companyFilter);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (minLevel > 0) params.set("minLevel", String(minLevel));

    setLoading(true);
    fetch(`/api/skill-matrix?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [companyFilter, categoryFilter, minLevel]);

  const allSkills = data?.categories.flatMap((c) =>
    c.skills.map((s) => ({ ...s, categoryId: c.id }))
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">スキルマトリクス</h1>
          <p className="text-sm text-slate-500">全メンバーのスキルレベル一覧</p>
        </div>
        {role === "admin" && (
          <Link href="/skills/settings">
            <Button variant="outline" size="sm">
              <Settings size={14} /> スキル設定
            </Button>
          </Link>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-500">レベル:</span>
        {[
          { v: "—", label: "未評価", cls: "bg-slate-100 text-slate-400" },
          { v: "1", label: "1: 初学者", cls: "bg-slate-200 text-slate-600" },
          { v: "2", label: "2: 基礎", cls: "bg-yellow-100 text-yellow-700" },
          { v: "3", label: "3: 実務可", cls: "bg-green-100 text-green-700" },
          { v: "4", label: "4: 熟練", cls: "bg-blue-100 text-blue-700" },
          { v: "5", label: "5: エキスパート", cls: "bg-purple-100 text-purple-700 font-bold" },
        ].map((item) => (
          <span key={item.v} className="flex items-center gap-1 text-xs">
            <span className={`rounded px-1.5 py-0.5 ${item.cls}`}>{item.v}</span>
            <span className="text-slate-500">{item.label}</span>
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">全カテゴリ</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={minLevel}
          onChange={(e) => setMinLevel(Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value={0}>最低レベル: 指定なし</option>
          <option value={2}>Lv2 以上</option>
          <option value={3}>Lv3 以上</option>
          <option value={4}>Lv4 以上</option>
          <option value={5}>Lv5 のみ</option>
        </select>
      </div>

      {/* Matrix table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 border border-slate-200 px-4 py-2 text-left text-xs font-semibold text-slate-600 min-w-[160px]">
                    メンバー
                  </th>
                  {data?.categories.map((cat) => (
                    <th
                      key={cat.id}
                      colSpan={cat.skills.length || 1}
                      className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-100"
                    >
                      {cat.name}
                    </th>
                  ))}
                </tr>
                <tr className="bg-white">
                  <th className="sticky left-0 z-10 bg-white border border-slate-200 px-4 py-2 text-left text-xs text-slate-400">
                    スキル →
                  </th>
                  {allSkills.map((skill) => (
                    <th
                      key={skill.id}
                      className="border border-slate-100 px-2 py-2 text-center text-xs font-medium text-slate-600 whitespace-nowrap min-w-[72px]"
                    >
                      {skill.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.members ?? []).map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white border border-slate-200 px-4 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <Link href={`/members/${member.id}`} className="text-slate-700 hover:text-blue-600">
                          {member.name}
                        </Link>
                        <Badge variant={member.company === "boost" ? "boost" : "salt2"} className="text-[10px] px-1.5">
                          {companyDisplay(member.company)}
                        </Badge>
                        {canEval && (
                          <Link
                            href={`/skills/evaluation/${member.id}`}
                            className="rounded p-0.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                            title="評価入力"
                          >
                            <ClipboardEdit size={13} />
                          </Link>
                        )}
                      </div>
                    </td>
                    {allSkills.map((skill) => {
                      const level = data?.levelMap[member.id]?.[skill.id] ?? null;
                      return <LevelCell key={skill.id} level={level} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.members.length ?? 0) === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                <Star size={24} className="mx-auto mb-2 text-slate-300" />
                条件に該当するメンバーがいません
              </div>
            )}
          </div>

          {/* Per-skill summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.categories ?? []).map((cat) => (
              <div key={cat.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">{cat.name}</h3>
                <div className="space-y-2">
                  {cat.skills.map((skill) => {
                    const levels = (data?.members ?? [])
                      .map((m) => data?.levelMap[m.id]?.[skill.id] ?? 0)
                      .filter((l) => l > 0);
                    const avg = levels.length > 0
                      ? (levels.reduce((s, l) => s + l, 0) / levels.length).toFixed(1)
                      : "—";
                    const maxLevel = levels.length > 0 ? Math.max(...levels) : 0;
                    return (
                      <div key={skill.id} className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">{skill.name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">avg {avg}</span>
                          {maxLevel > 0 && (
                            <span className={`rounded px-1.5 py-0.5 ${levelStyle[maxLevel]}`}>
                              max {maxLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
