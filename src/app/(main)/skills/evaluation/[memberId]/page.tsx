"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Save, CheckCircle, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

interface EvalRecord {
  id: string;
  skillId: string;
  skillName: string;
  categoryId: string;
  categoryName: string;
  level: number;
  evaluatedAt: string;
  memo: string | null;
  evaluatorName: string;
}

interface SkillItem { id: string; name: string }
interface Category  { id: string; name: string; skills: SkillItem[] }

interface MemberInfo {
  id: string;
  name: string;
  company: string;
  status: string;
}

// ─── スタイル ────────────────────────────────────────────

const LEVEL_LABELS: Record<number, string> = {
  1: "初学者", 2: "初級", 3: "中級", 4: "上級", 5: "エキスパート",
};
const LEVEL_COLORS: Record<number, string> = {
  1: "bg-slate-100 text-slate-600 border-slate-300",
  2: "bg-yellow-100 text-yellow-700 border-yellow-300",
  3: "bg-green-100 text-green-700 border-green-300",
  4: "bg-blue-100 text-blue-700 border-blue-300",
  5: "bg-purple-100 text-purple-700 border-purple-300",
};

const today = new Date().toISOString().slice(0, 10);

// ─── ページ ───────────────────────────────────────────────

export default function SkillEvaluationPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "manager";

  // ─── データ ─────────────────────────────────────────────

  const [member, setMember] = useState<MemberInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<EvalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 評価フォーム: skillId → { level, memo, evalDate }
  const [evals, setEvals] = useState<Record<string, { level: number | null; memo: string; evalDate: string }>>({});
  const [activeCat, setActiveCat] = useState<string>("");
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/members/${memberId}/skills`);
    if (!res.ok) return;
    const data: EvalRecord[] = await res.json();
    setHistory(data);
    // 最新レベルでフォームを初期化（既存値を上書きしない）
    const latestMap: Record<string, number> = {};
    for (const r of data) {
      if (!(r.skillId in latestMap)) latestMap[r.skillId] = r.level;
    }
    setEvals((prev) => {
      const next = { ...prev };
      for (const [sid, lvl] of Object.entries(latestMap)) {
        if (!next[sid]) next[sid] = { level: lvl, memo: "", evalDate: today };
      }
      return next;
    });
  }, [memberId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [memberRes, catRes] = await Promise.all([
        fetch(`/api/members/${memberId}`),
        fetch("/api/skill-categories"),
      ]);
      if (memberRes.status === 404) { router.push("/skills"); return; }
      const memberData: MemberInfo = await memberRes.json();
      const catData: Category[] = await catRes.json();
      if (cancelled) return;
      setMember(memberData);
      setCategories(catData);
      if (catData.length > 0) setActiveCat(catData[0].id);

      // 全スキルのフォームを初期化
      const initEvals: Record<string, { level: number | null; memo: string; evalDate: string }> = {};
      for (const cat of catData) {
        for (const sk of cat.skills) {
          initEvals[sk.id] = { level: null, memo: "", evalDate: today };
        }
      }
      setEvals(initEvals);
      await loadHistory();
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [memberId, router, loadHistory]);

  // ─── アクション ──────────────────────────────────────────

  function updateEval(skillId: string, field: "level" | "memo" | "evalDate", value: string | number | null) {
    setEvals((prev) => ({ ...prev, [skillId]: { ...prev[skillId], [field]: value } }));
    setSaved(false);
  }

  async function handleSave() {
    const activeCatData = categories.find((c) => c.id === activeCat);
    if (!activeCatData) return;

    // バリデーション: level 未選択のスキルはエラー
    const newErrors: Record<string, string> = {};
    for (const sk of activeCatData.skills) {
      if (evals[sk.id]?.level === null) {
        newErrors[sk.id] = "レベルを選択してください";
      }
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true); setErrors({});
    const promises = activeCatData.skills.map((sk) => {
      const ev = evals[sk.id];
      if (!ev || ev.level === null) return Promise.resolve();
      return fetch(`/api/members/${memberId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: sk.id,
          level: ev.level,
          evaluatedAt: ev.evalDate,
          memo: ev.memo || undefined,
        }),
      });
    });
    await Promise.all(promises);
    await loadHistory();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggleHistory(skillId: string) {
    setExpandedHistory((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(skillId)) next.delete(skillId); else next.add(skillId);
      return next;
    });
  }

  // ─── 表示 ────────────────────────────────────────────────

  if (loading) return <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>;
  if (!member) return null;

  const activeCatData = categories.find((c) => c.id === activeCat);

  // skillId ごとの履歴マップ
  const historyBySid: Record<string, EvalRecord[]> = {};
  for (const r of history) {
    if (!historyBySid[r.skillId]) historyBySid[r.skillId] = [];
    historyBySid[r.skillId].push(r);
  }

  const totalEvaluated = Object.values(evals).filter((e) => e.level !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/skills">
          <Button variant="outline" size="sm"><ArrowLeft size={14} /> スキルマトリクスへ</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">スキル評価入力</h1>
          <p className="text-sm text-slate-500">メンバーのスキルレベルを評価・更新します</p>
        </div>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saving ? "保存中..." : saved ? "保存済み" : "保存"}
          </Button>
        )}
      </div>

      {/* Member info */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <User size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-slate-800">{member.name}</span>
              <Badge variant={member.company === "boost" ? "boost" : "salt2"}>
                {member.company === "boost" ? "Boost" : "SALT2"}
              </Badge>
              {!canEdit && <Badge variant="default">閲覧のみ</Badge>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400">評価登録スキル数</p>
            <p className="text-2xl font-bold text-blue-600">{totalEvaluated}</p>
          </div>
        </div>
      </Card>

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {categories.map((cat) => {
          const catSkillIds = cat.skills.map((s) => s.id);
          const count = catSkillIds.filter((sid) => evals[sid]?.level !== null).length;
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); setErrors({}); }}
              className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeCat === cat.id
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {cat.name}
              <span className={`text-xs ${count === cat.skills.length ? "text-green-600" : "text-slate-400"}`}>
                {count}/{cat.skills.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Skill evaluation rows */}
      <div className="space-y-3">
        {(activeCatData?.skills ?? []).map((sk) => {
          const ev = evals[sk.id] ?? { level: null, memo: "", evalDate: today };
          const skillHistory = historyBySid[sk.id] ?? [];
          const isExpanded = expandedHistory.has(sk.id);
          return (
            <Card key={sk.id}>
              <div className="space-y-3">
                {/* Skill name + level selector */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[140px] text-sm font-semibold text-slate-800">{sk.name}</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        disabled={!canEdit}
                        onClick={() => updateEval(sk.id, "level", lvl)}
                        className={`rounded-md border px-3 py-1 text-xs font-medium transition-all ${
                          ev.level === lvl
                            ? LEVEL_COLORS[lvl] + " border-current shadow-sm"
                            : "border-slate-200 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-700"
                        } ${!canEdit ? "cursor-default opacity-70" : "cursor-pointer"}`}
                        title={LEVEL_LABELS[lvl]}
                      >
                        {lvl} {LEVEL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                  {errors[sk.id] && <p className="text-xs text-red-600">{errors[sk.id]}</p>}
                </div>

                {/* Memo + date */}
                {canEdit && (
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      maxLength={500}
                      placeholder="評価メモ（任意・最大500文字）"
                      value={ev.memo}
                      onChange={(e) => updateEval(sk.id, "memo", e.target.value)}
                      className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      max={today}
                      value={ev.evalDate}
                      onChange={(e) => updateEval(sk.id, "evalDate", e.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* History toggle */}
                {skillHistory.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleHistory(sk.id)}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      評価履歴 ({skillHistory.length} 件)
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-4">
                        {skillHistory.map((h) => (
                          <div key={h.id} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-1.5 text-xs">
                            <span className="text-slate-400 w-20 shrink-0">
                              {new Date(h.evaluatedAt).toLocaleDateString("ja-JP")}
                            </span>
                            <span className={`rounded px-2 py-0.5 font-medium ${LEVEL_COLORS[h.level]}`}>
                              Lv{h.level} {LEVEL_LABELS[h.level]}
                            </span>
                            <span className="flex-1 text-slate-600 truncate">{h.memo || "—"}</span>
                            <span className="text-slate-400 shrink-0">{h.evaluatorName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
