"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowLeft, Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { notFound } from "next/navigation";

// ─── 型定義 ──────────────────────────────────────────────

interface SkillItem { id: string; name: string; displayOrder: number }
interface Category  { id: string; name: string; displayOrder: number; skills: SkillItem[] }

// ─── ページ ───────────────────────────────────────────────

export default function SkillSettingsPage() {
  const { role } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Category add form
  const [newCatName, setNewCatName] = useState("");
  const [catError, setCatError] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Skill add form per category
  const [newSkillName, setNewSkillName] = useState<Record<string, string>>({});
  const [skillError, setSkillError] = useState<Record<string, string>>({});
  const [skillSaving, setSkillSaving] = useState<Record<string, boolean>>({});

  // Edit state
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editSkillName, setEditSkillName] = useState("");

  useEffect(() => {
    fetch("/api/skill-categories")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        setExpandedCats(new Set(data.map((c) => c.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  if (role !== "admin") return notFound();

  function toggleExpand(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }

  // ─── Category CRUD ─────────────────────────────────────

  async function addCategory() {
    const trimmed = newCatName.trim();
    if (!trimmed) { setCatError("カテゴリ名を入力してください"); return; }
    setCatSaving(true);
    const res = await fetch("/api/skill-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setCatSaving(false);
    if (res.ok) {
      const cat: Category = await res.json();
      setCategories((prev) => [...prev, { ...cat, skills: [] }]);
      setExpandedCats((prev) => new Set(Array.from(prev).concat(cat.id)));
      setNewCatName(""); setCatError("");
    } else {
      const data = await res.json();
      setCatError(data.error?.message ?? "追加に失敗しました");
    }
  }

  async function deleteCategory(catId: string) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    if (!confirm(`「${cat.name}」を削除しますか？`)) return;
    const res = await fetch(`/api/skill-categories/${catId}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    } else {
      const data = await res.json();
      alert(data.error?.message ?? "削除に失敗しました");
    }
  }

  async function commitEditCat(catId: string) {
    const trimmed = editCatName.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/skill-categories/${catId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setCategories((prev) => prev.map((c) => c.id === catId ? { ...c, name: trimmed } : c));
      setEditingCat(null);
    } else {
      const data = await res.json();
      alert(data.error?.message ?? "更新に失敗しました");
    }
  }

  // ─── Skill CRUD ────────────────────────────────────────

  async function addSkill(catId: string) {
    const trimmed = (newSkillName[catId] ?? "").trim();
    if (!trimmed) {
      setSkillError((prev) => ({ ...prev, [catId]: "スキル名を入力してください" }));
      return;
    }
    setSkillSaving((prev) => ({ ...prev, [catId]: true }));
    const res = await fetch(`/api/skill-categories/${catId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSkillSaving((prev) => ({ ...prev, [catId]: false }));
    if (res.ok) {
      const skill: SkillItem = await res.json();
      setCategories((prev) =>
        prev.map((c) => c.id === catId ? { ...c, skills: [...c.skills, skill] } : c)
      );
      setNewSkillName((prev) => ({ ...prev, [catId]: "" }));
      setSkillError((prev) => ({ ...prev, [catId]: "" }));
    } else {
      const data = await res.json();
      setSkillError((prev) => ({ ...prev, [catId]: data.error?.message ?? "追加に失敗しました" }));
    }
  }

  async function deleteSkill(catId: string, skillId: string) {
    if (!confirm("このスキルを削除しますか？")) return;
    const res = await fetch(`/api/skill-categories/${catId}/skills/${skillId}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) =>
        prev.map((c) => c.id === catId ? { ...c, skills: c.skills.filter((s) => s.id !== skillId) } : c)
      );
    } else {
      const data = await res.json();
      alert(data.error?.message ?? "削除に失敗しました");
    }
  }

  async function commitEditSkill(catId: string, skillId: string) {
    const trimmed = editSkillName.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/skill-categories/${catId}/skills/${skillId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === catId
            ? { ...c, skills: c.skills.map((s) => s.id === skillId ? { ...s, name: trimmed } : s) }
            : c
        )
      );
      setEditingSkill(null);
    } else {
      const data = await res.json();
      alert(data.error?.message ?? "更新に失敗しました");
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/skills">
          <Button variant="outline" size="sm">
            <ArrowLeft size={14} /> スキルマトリクスへ
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">スキル設定</h1>
          <p className="text-sm text-slate-500">カテゴリとスキル項目のマスタ管理</p>
        </div>
      </div>

      {/* Category list */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleExpand(cat.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {expandedCats.has(cat.id)
                  ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
                  : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                {editingCat === cat.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && commitEditCat(cat.id)}
                      className="h-7 text-sm w-48"
                      autoFocus
                    />
                    <button onClick={() => commitEditCat(cat.id)} className="text-green-600 hover:text-green-700">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditingCat(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-800">{cat.name}</span>
                )}
                <Badge variant="default" className="ml-1">{cat.skills.length} スキル</Badge>
              </button>

              {editingCat !== cat.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); }}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            {expandedCats.has(cat.id) && (
              <div className="mt-3 space-y-1.5 pl-6">
                {cat.skills.map((skill) => (
                  <div key={skill.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-1.5">
                    {editingSkill === skill.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editSkillName}
                          onChange={(e) => setEditSkillName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitEditSkill(cat.id, skill.id)}
                          className="h-7 text-sm w-48"
                          autoFocus
                        />
                        <button onClick={() => commitEditSkill(cat.id, skill.id)} className="text-green-600">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingSkill(null)} className="text-slate-400">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="flex-1 text-sm text-slate-700">{skill.name}</span>
                    )}
                    {editingSkill !== skill.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingSkill(skill.id); setEditSkillName(skill.name); }}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteSkill(cat.id, skill.id)}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="スキル名を入力"
                    value={newSkillName[cat.id] ?? ""}
                    onChange={(e) => setNewSkillName((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addSkill(cat.id)}
                    className="h-7 text-sm"
                  />
                  <Button
                    variant="outline" size="sm"
                    onClick={() => addSkill(cat.id)}
                    disabled={skillSaving[cat.id]}
                  >
                    <Plus size={13} /> 追加
                  </Button>
                </div>
                {skillError[cat.id] && (
                  <p className="text-xs text-red-600">{skillError[cat.id]}</p>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add category */}
      <Card>
        <CardHeader>
          <CardTitle>カテゴリを追加</CardTitle>
          <Plus size={16} className="text-slate-400" />
        </CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <Input
              placeholder="カテゴリ名を入力（例：デザイン）"
              value={newCatName}
              onChange={(e) => { setNewCatName(e.target.value); setCatError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            {catError && <p className="mt-1 text-xs text-red-600">{catError}</p>}
          </div>
          <Button variant="primary" size="sm" onClick={addCategory} disabled={catSaving}>
            <Plus size={14} /> {catSaving ? "追加中..." : "カテゴリ追加"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
