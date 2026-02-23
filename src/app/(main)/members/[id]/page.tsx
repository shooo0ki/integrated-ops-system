"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, Calendar, Edit, Save, X,
  Wrench, Plus, Trash2, BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

interface ToolItem {
  id: string;
  toolName: string;
  plan: string | null;
  monthlyCost: number;
  companyLabel: string;
  note: string | null;
}

interface SkillItem {
  id: string;
  skillId: string;
  skillName: string;
  categoryName: string;
  level: number;
  evaluatedAt: string;
  memo: string | null;
}

interface ContractItem {
  id: string;
  status: string;
  templateName: string;
  startDate: string | null;
  endDate: string | null;
}

interface MemberDetail {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  company: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  email: string;
  role: string;
  tools: ToolItem[];
  skills: SkillItem[];
  contracts: ContractItem[];
}

// ─── 表示用マップ ─────────────────────────────────────────

const statusLabel: Record<string, string> = {
  executive: "役員", employee: "社員",
  intern_full: "インターン（長期）", intern_training: "インターン（研修）",
  training_member: "研修生",
};
const roleLabel: Record<string, string> = {
  admin: "管理者", manager: "マネージャー", employee: "社員", intern: "インターン",
};
const salaryTypeLabel: Record<string, string> = { monthly: "月給制", hourly: "時給制" };
const levelStars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const contractStatusLabel: Record<string, string> = {
  draft: "下書き", sent: "送付済み", waiting_sign: "署名待ち",
  completed: "完了", voided: "無効",
};
const fmt = (n: number) => n.toLocaleString("ja-JP") + "円";
const companyDisplay = (c: string) => c === "boost" ? "Boost" : c === "salt2" ? "SALT2" : c;

// ─── ページ ───────────────────────────────────────────────

export default function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role: myRole } = useAuth();
  const canEdit = myRole === "admin" || myRole === "manager";
  const canDelete = myRole === "admin";

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MemberDetail>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Tool フォーム
  const [showToolForm, setShowToolForm] = useState(false);
  const [toolForm, setToolForm] = useState({
    toolName: "", plan: "", monthlyCost: "0", companyLabel: "boost", note: "",
  });
  const [editingTool, setEditingTool] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((r) => {
        if (r.status === 404) { router.push("/members"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setMember(data); })
      .finally(() => setLoading(false));
  }, [id, router]);

  function startEdit() {
    if (!member) return;
    setEditForm({
      name: member.name, phone: member.phone ?? "",
      status: member.status, company: member.company,
      salaryType: member.salaryType, salaryAmount: member.salaryAmount,
      role: member.role,
    });
    setEditMode(true);
  }

  async function saveEdit() {
    setSaving(true); setError("");
    const res = await fetch(`/api/members/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, salaryAmount: Number(editForm.salaryAmount) }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setMember((m) => m ? { ...m, ...editForm, name: updated.name } : m);
      setEditMode(false);
    } else {
      const data = await res.json();
      setError(data.error?.message ?? "保存に失敗しました");
    }
  }

  async function deleteMember() {
    if (!confirm(`${member?.name} を削除しますか？`)) return;
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/members");
  }

  async function addTool() {
    const res = await fetch(`/api/members/${id}/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName: toolForm.toolName,
        plan: toolForm.plan || undefined,
        monthlyCost: Number(toolForm.monthlyCost),
        companyLabel: toolForm.companyLabel,
        note: toolForm.note || undefined,
      }),
    });
    if (res.ok) {
      const tool = await res.json();
      setMember((m) => m ? { ...m, tools: [...m.tools, tool] } : m);
      setToolForm({ toolName: "", plan: "", monthlyCost: "0", companyLabel: "boost", note: "" });
      setShowToolForm(false);
    }
  }

  async function updateTool(toolId: string) {
    const tool = member?.tools.find((t) => t.id === toolId);
    if (!tool) return;
    const res = await fetch(`/api/members/${id}/tools/${toolId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName: toolForm.toolName,
        plan: toolForm.plan || undefined,
        monthlyCost: Number(toolForm.monthlyCost),
        companyLabel: toolForm.companyLabel,
        note: toolForm.note || undefined,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMember((m) => m ? { ...m, tools: m.tools.map((t) => t.id === toolId ? updated : t) } : m);
      setEditingTool(null);
    }
  }

  async function deleteTool(toolId: string) {
    if (!confirm("このツールを削除しますか？")) return;
    const res = await fetch(`/api/members/${id}/tools/${toolId}`, { method: "DELETE" });
    if (res.ok) {
      setMember((m) => m ? { ...m, tools: m.tools.filter((t) => t.id !== toolId) } : m);
    }
  }

  function startEditTool(tool: ToolItem) {
    setToolForm({
      toolName: tool.toolName, plan: tool.plan ?? "",
      monthlyCost: String(tool.monthlyCost), companyLabel: tool.companyLabel, note: tool.note ?? "",
    });
    setEditingTool(tool.id);
    setShowToolForm(false);
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>;
  }
  if (!member) return null;

  const byCategory = member.skills.reduce<Record<string, SkillItem[]>>((acc, s) => {
    if (!acc[s.categoryName]) acc[s.categoryName] = [];
    acc[s.categoryName].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/members" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
        <ArrowLeft size={16} /> メンバー一覧に戻る
      </Link>

      {/* Profile card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
              {member.name.charAt(0)}
            </div>
            <div>
              {editMode ? (
                <Input
                  id="edit-name"
                  value={String(editForm.name ?? "")}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mb-1"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-800">{member.name}</h1>
                  <Badge variant={member.company === "boost" ? "boost" : "salt2"}>
                    {companyDisplay(member.company)}
                  </Badge>
                </div>
              )}
              <p className="mt-1 text-sm text-slate-600">
                {statusLabel[member.status] ?? member.status} / {roleLabel[member.role] ?? member.role}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button variant="primary" size="sm" onClick={saveEdit} disabled={saving}>
                  <Save size={14} /> {saving ? "保存中..." : "保存"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setError(""); }}>
                  <X size={14} /> キャンセル
                </Button>
              </>
            ) : (
              <>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Edit size={14} /> 編集
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" size="sm" onClick={deleteMember} className="text-red-600 hover:bg-red-50">
                    <Trash2 size={14} /> 削除
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Contact / Contract */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />
            <span className="text-sm text-slate-600">{member.email}</span>
          </div>
          {member.phone && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" />
              <span className="text-sm text-slate-600">{member.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-sm text-slate-600">
              入社: {new Date(member.joinedAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            {salaryTypeLabel[member.salaryType] ?? member.salaryType}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
            {member.salaryType === "monthly"
              ? `月額 ${fmt(member.salaryAmount)}`
              : `時給 ${fmt(member.salaryAmount)}/h`}
          </span>
        </div>

        {/* Edit form */}
        {editMode && (
          <div className="mt-4 border-t border-slate-100 pt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select id="edit-status" label="ステータス"
              value={String(editForm.status ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="executive">役員</option>
              <option value="employee">社員</option>
              <option value="intern_full">インターン（長期）</option>
              <option value="intern_training">インターン（研修）</option>
              <option value="training_member">研修生</option>
            </Select>
            <Select id="edit-role" label="ロール"
              value={String(editForm.role ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="admin">管理者</option>
              <option value="manager">マネージャー</option>
              <option value="employee">社員</option>
              <option value="intern">インターン</option>
            </Select>
            <Select id="edit-company" label="会社"
              value={String(editForm.company ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}>
              <option value="boost">Boost</option>
              <option value="salt2">SALT2</option>
            </Select>
            <Select id="edit-salaryType" label="給与種別"
              value={String(editForm.salaryType ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, salaryType: e.target.value }))}>
              <option value="monthly">月給制</option>
              <option value="hourly">時給制</option>
            </Select>
            <Input id="edit-salaryAmount" type="number" label="金額（円）"
              value={String(editForm.salaryAmount ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, salaryAmount: Number(e.target.value) }))} />
            <Input id="edit-phone" label="電話番号"
              value={String(editForm.phone ?? "")}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tools */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Wrench size={16} /> 使用ツール
            </h3>
            {canEdit && !showToolForm && !editingTool && (
              <Button variant="outline" size="sm" onClick={() => setShowToolForm(true)}>
                <Plus size={14} /> 追加
              </Button>
            )}
          </div>

          {/* Add form */}
          {showToolForm && (
            <div className="mb-4 rounded-lg bg-slate-50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input id="tool-name" label="ツール名 *" value={toolForm.toolName}
                  onChange={(e) => setToolForm((f) => ({ ...f, toolName: e.target.value }))} />
                <Input id="tool-plan" label="プラン" value={toolForm.plan}
                  onChange={(e) => setToolForm((f) => ({ ...f, plan: e.target.value }))} />
                <Input id="tool-cost" type="number" label="月額費用（円）" value={toolForm.monthlyCost}
                  onChange={(e) => setToolForm((f) => ({ ...f, monthlyCost: e.target.value }))} />
                <Select id="tool-company" label="会社" value={toolForm.companyLabel}
                  onChange={(e) => setToolForm((f) => ({ ...f, companyLabel: e.target.value }))}>
                  <option value="boost">Boost</option>
                  <option value="salt2">SALT2</option>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowToolForm(false)}>キャンセル</Button>
                <Button variant="primary" size="sm" onClick={addTool} disabled={!toolForm.toolName}>追加</Button>
              </div>
            </div>
          )}

          {member.tools.length === 0 && !showToolForm && (
            <p className="text-sm text-slate-500">ツールデータがありません。</p>
          )}

          <div className="space-y-2">
            {member.tools.map((tool) =>
              editingTool === tool.id ? (
                <div key={tool.id} className="rounded-lg bg-slate-50 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input id="et-name" label="ツール名 *" value={toolForm.toolName}
                      onChange={(e) => setToolForm((f) => ({ ...f, toolName: e.target.value }))} />
                    <Input id="et-plan" label="プラン" value={toolForm.plan}
                      onChange={(e) => setToolForm((f) => ({ ...f, plan: e.target.value }))} />
                    <Input id="et-cost" type="number" label="月額費用（円）" value={toolForm.monthlyCost}
                      onChange={(e) => setToolForm((f) => ({ ...f, monthlyCost: e.target.value }))} />
                    <Select id="et-company" label="会社" value={toolForm.companyLabel}
                      onChange={(e) => setToolForm((f) => ({ ...f, companyLabel: e.target.value }))}>
                      <option value="boost">Boost</option>
                      <option value="salt2">SALT2</option>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingTool(null)}>キャンセル</Button>
                    <Button variant="primary" size="sm" onClick={() => updateTool(tool.id)}>保存</Button>
                  </div>
                </div>
              ) : (
                <div key={tool.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{tool.toolName}</span>
                    {tool.plan && <span className="ml-2 text-xs text-slate-400">{tool.plan}</span>}
                    <div className="text-xs text-slate-400 mt-0.5">
                      {companyDisplay(tool.companyLabel)} / {fmt(tool.monthlyCost)}/月
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => startEditTool(tool)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <Edit size={13} />
                      </button>
                      <button onClick={() => deleteTool(tool.id)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <BookOpen size={16} /> スキル
            </h3>
            {canEdit && (
              <Link href={`/skills/evaluation/${id}`}>
                <Button variant="outline" size="sm"><Edit size={14} /> 評価</Button>
              </Link>
            )}
          </div>

          {Object.keys(byCategory).length === 0 ? (
            <p className="text-sm text-slate-500">スキルデータがありません。</p>
          ) : (
            Object.entries(byCategory).map(([cat, skills]) => (
              <div key={cat} className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{cat}</p>
                <div className="space-y-1">
                  {skills.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5">
                      <span className="text-sm text-slate-700">{s.skillName}</span>
                      <span className="text-sm text-blue-600">{levelStars(s.level)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contracts */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-base font-semibold text-slate-800">契約書</h3>
        {member.contracts.length === 0 ? (
          <p className="text-sm text-slate-500">契約書データがありません。</p>
        ) : (
          <div className="space-y-3">
            {member.contracts.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{c.templateName}</span>
                  <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                    {contractStatusLabel[c.status] ?? c.status}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-slate-500">
                  {c.startDate && <span>開始: {new Date(c.startDate).toLocaleDateString("ja-JP")}</span>}
                  {c.endDate && <span>終了: {new Date(c.endDate).toLocaleDateString("ja-JP")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
