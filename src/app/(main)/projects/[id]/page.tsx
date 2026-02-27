"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Calendar, DollarSign, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

interface Position {
  id: string;
  positionName: string;
  requiredCount: number;
  assignmentCount: number;
}

interface Assignment {
  id: string;
  memberId: string;
  memberName: string;
  positionName: string;
  positionId: string;
  workloadHours: number;
  startDate: string;
  endDate: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  company: string;
  projectType: string;
  startDate: string;
  endDate: string | null;
  clientName: string | null;
  contractType: string | null;
  monthlyContractAmount: number;
  positions: Position[];
  assignments: Assignment[];
}

interface EditForm {
  name: string;
  description: string;
  status: string;
  clientName: string;
  contractType: string;
  monthlyContractAmount: string;
  startDate: string;
  endDate: string;
}

interface MemberOption {
  id: string;
  name: string;
  company: string;
}

// ─── ユーティリティ ──────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: "進行中", completed: "完了", on_hold: "一時停止", planning: "計画中",
};
const STATUS_COLOR: Record<string, "success" | "default" | "warning"> = {
  active: "success", completed: "default", on_hold: "warning", planning: "warning",
};
const CONTRACT_LABELS: Record<string, string> = {
  quasi_mandate: "準委任", contract: "請負", in_house: "自社開発", other: "その他",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}
function formatCurrency(n: number): string {
  return n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });
}
function toDateInput(d: string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

// ─── ページ ───────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { role } = useAuth();
  const canManage = role === "admin" || role === "manager";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // プロジェクト編集
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({
    name: "", description: "", status: "active",
    clientName: "", contractType: "", monthlyContractAmount: "",
    startDate: "", endDate: "",
  });

  // アサイン管理
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [assignForm, setAssignForm] = useState({ memberId: "", positionId: "", workloadHours: "80", startDate: today });
  const [positionMode, setPositionMode] = useState<"existing" | "new">("existing");
  const [newPositionName, setNewPositionName] = useState("");

  const loadProject = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`);
    if (r.status === 404) { router.push("/projects"); return; }
    const data: ProjectDetail = await r.json();
    setProject(data);
    setForm({
      name: data.name,
      description: data.description ?? "",
      status: data.status,
      clientName: data.clientName ?? "",
      contractType: data.contractType ?? "",
      monthlyContractAmount: String(data.monthlyContractAmount),
      startDate: toDateInput(data.startDate),
      endDate: toDateInput(data.endDate),
    });
  }, [id, router]);

  useEffect(() => {
    Promise.all([
      loadProject(),
      fetch("/api/members").then(r => r.json()).then(setMembers),
    ]).finally(() => setLoading(false));
  }, [loadProject]);

  // ─── プロジェクト編集 ──────────────────────────────────

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        status: form.status,
        clientName: form.clientName || null,
        contractType: form.contractType || null,
        monthlyContractAmount: Number(form.monthlyContractAmount) || 0,
        startDate: form.startDate,
        endDate: form.endDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      await loadProject();
      setEditing(false);
      setSaveMsg("保存しました");
      setTimeout(() => setSaveMsg(null), 3000);
    } else {
      setSaveMsg("保存に失敗しました");
    }
  }

  function cancelEdit() {
    if (!project) return;
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      clientName: project.clientName ?? "",
      contractType: project.contractType ?? "",
      monthlyContractAmount: String(project.monthlyContractAmount),
      startDate: toDateInput(project.startDate),
      endDate: toDateInput(project.endDate),
    });
    setEditing(false);
  }

  function set(key: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  // ─── アサイン追加 ──────────────────────────────────────

  function openAddModal() {
    setAssignError("");
    setPositionMode(project && project.positions.length > 0 ? "existing" : "new");
    setNewPositionName("");
    setAssignForm({ memberId: "", positionId: "", workloadHours: "80", startDate: today });
    setAddOpen(true);
  }

  async function handleAddAssignment() {
    if (!assignForm.memberId || !assignForm.startDate) {
      setAssignError("メンバーと開始日を入力してください");
      return;
    }
    if (positionMode === "existing" && !assignForm.positionId) {
      setAssignError("ポジションを選択してください");
      return;
    }
    if (positionMode === "new" && !newPositionName.trim()) {
      setAssignError("新規ポジション名を入力してください");
      return;
    }

    setAssignSaving(true);
    setAssignError("");

    let positionId = assignForm.positionId;

    if (positionMode === "new") {
      const posRes = await fetch(`/api/projects/${id}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionName: newPositionName.trim(), requiredCount: 1 }),
      });
      if (!posRes.ok) {
        let msg = "ポジション作成に失敗しました";
        try { const d = await posRes.json(); msg = d.error?.message ?? msg; } catch {}
        setAssignError(msg);
        setAssignSaving(false);
        return;
      }
      positionId = (await posRes.json()).id;
    }

    const res = await fetch(`/api/projects/${id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionId,
        memberId: assignForm.memberId,
        workloadHours: Number(assignForm.workloadHours),
        startDate: assignForm.startDate,
      }),
    });
    setAssignSaving(false);
    if (res.ok) {
      await loadProject();
      setAddOpen(false);
    } else {
      let msg = "登録に失敗しました";
      try { const d = await res.json(); msg = d.error?.message ?? msg; } catch {}
      setAssignError(msg);
    }
  }

  async function handleDeleteAssignment(assignId: string) {
    setDeleteId(assignId);
    const res = await fetch(`/api/projects/${id}/assignments/${assignId}`, { method: "DELETE" });
    setDeleteId(null);
    if (res.ok) await loadProject();
  }

  // ─── レンダー ─────────────────────────────────────────

  if (loading) return <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>;
  if (!project) return null;

  const companyDisplay = project.company === "boost" ? "Boost" : "SALT2";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
          <ArrowLeft size={16} /> 一覧に戻る
        </Link>
        {saveMsg && (
          <span className={`text-sm ${saveMsg.includes("失敗") ? "text-red-600" : "text-green-600"}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ─ プロジェクト情報 ─ */}
      <Card>
        {editing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">プロジェクト編集</h2>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  <Check size={14} /> {saving ? "保存中..." : "保存"}
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X size={14} /> キャンセル
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">プロジェクト名 *</label>
                <input type="text" value={form.name} onChange={set("name")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">説明</label>
                <textarea value={form.description} onChange={set("description")} rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ステータス</label>
                <select value={form.status} onChange={set("status")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="planning">計画中</option>
                  <option value="active">進行中</option>
                  <option value="on_hold">一時停止</option>
                  <option value="completed">完了</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">クライアント名</label>
                <input type="text" value={form.clientName} onChange={set("clientName")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">契約種別</label>
                <select value={form.contractType} onChange={set("contractType")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">未設定</option>
                  <option value="quasi_mandate">準委任</option>
                  <option value="contract">請負</option>
                  <option value="in_house">自社開発</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">月額契約金額（円）</label>
                <input type="number" min={0} value={form.monthlyContractAmount} onChange={set("monthlyContractAmount")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">開始日</label>
                <input type="date" value={form.startDate} onChange={set("startDate")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">終了日（任意）</label>
                <input type="date" value={form.endDate} onChange={set("endDate")}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={project.company === "boost" ? "boost" : "salt2"}>{companyDisplay}</Badge>
                  <Badge variant={STATUS_COLOR[project.status] ?? "default"}>{STATUS_LABELS[project.status] ?? project.status}</Badge>
                </div>
                <h1 className="mt-2 text-xl font-bold text-slate-800">{project.name}</h1>
                {project.description && (
                  <p className="mt-1 text-sm text-slate-600">{project.description}</p>
                )}
              </div>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> 編集
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Calendar size={14} className="text-slate-400" />
                {formatDate(project.startDate)}{project.endDate ? ` 〜 ${formatDate(project.endDate)}` : " 〜"}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Users size={14} className="text-slate-400" /> {project.assignments.length}名アサイン
              </div>
              {project.clientName && (
                <div className="flex items-center gap-1.5 text-sm text-slate-600 col-span-2">
                  クライアント: {project.clientName}
                </div>
              )}
              {canManage && (
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <DollarSign size={14} className="text-slate-400" />
                  月額: <span className="font-semibold">{formatCurrency(project.monthlyContractAmount)}</span>
                </div>
              )}
              {project.contractType && (
                <div className="text-sm text-slate-600">
                  契約: {CONTRACT_LABELS[project.contractType] ?? project.contractType}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ─ アサインメンバー ─ */}
      <Card>
        <CardHeader>
          <CardTitle>アサインメンバー</CardTitle>
          {canManage && (
            <Button variant="primary" size="sm" onClick={openAddModal}>
              <Plus size={14} /> 追加
            </Button>
          )}
        </CardHeader>

        {/* ポジション充足状況 */}
        {project.positions.length > 0 && (
          <div className="mb-4 flex gap-2 flex-wrap">
            {project.positions.map((pos) => (
              <div key={pos.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                <span className="text-sm text-slate-700">{pos.positionName}</span>
                {pos.assignmentCount >= pos.requiredCount ? (
                  <Badge variant="success" className="text-xs">充足</Badge>
                ) : (
                  <Badge variant="warning" className="text-xs">空き {pos.requiredCount - pos.assignmentCount}名</Badge>
                )}
                <span className="text-xs text-slate-400">{pos.assignmentCount}/{pos.requiredCount}名</span>
              </div>
            ))}
          </div>
        )}

        {project.assignments.length === 0 ? (
          <p className="text-sm text-slate-400">アサインされているメンバーがいません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="py-2 text-left font-medium">名前</th>
                  <th className="py-2 text-left font-medium">ポジション</th>
                  <th className="py-2 text-right font-medium">月間工数</th>
                  <th className="py-2 text-left font-medium">開始日</th>
                  {canManage && <th className="py-2 w-8" />}
                </tr>
              </thead>
              <tbody>
                {project.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2">
                      <Link href={`/members/${a.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">
                        {a.memberName}
                      </Link>
                    </td>
                    <td className="py-2 text-slate-500">{a.positionName}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{a.workloadHours}h/月</td>
                    <td className="py-2 text-xs text-slate-400">{formatDate(a.startDate)}</td>
                    {canManage && (
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDeleteAssignment(a.id)}
                          disabled={deleteId === a.id}
                          className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-40"
                          title="アサイン解除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─ アサイン追加モーダル ─ */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setAssignError(""); }} title="メンバーをアサイン">
        <div className="space-y-3">
          {assignError && <p className="text-xs text-red-600">{assignError}</p>}

          <Select id="assignMemberId" label="メンバー *" value={assignForm.memberId}
            onChange={(e) => setAssignForm(f => ({ ...f, memberId: e.target.value }))}>
            <option value="">選択してください</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.company === "boost" ? "Boost" : "SALT2"}）
              </option>
            ))}
          </Select>

          {/* ポジション */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ポジション *</label>
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => setPositionMode("existing")}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  positionMode === "existing"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}>
                既存から選択
              </button>
              <button type="button" onClick={() => setPositionMode("new")}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  positionMode === "new"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}>
                ＋ 新規作成
              </button>
            </div>
            {positionMode === "existing" ? (
              project.positions.length > 0 ? (
                <Select id="assignPositionId" label="" value={assignForm.positionId}
                  onChange={(e) => setAssignForm(f => ({ ...f, positionId: e.target.value }))}>
                  <option value="">選択してください</option>
                  {project.positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.positionName}</option>
                  ))}
                </Select>
              ) : (
                <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                  ポジションがありません。「新規作成」で追加してください。
                </p>
              )
            ) : (
              <Input id="newPositionName" label="" placeholder="ポジション名（例: バックエンドエンジニア）"
                value={newPositionName} onChange={(e) => setNewPositionName(e.target.value)} />
            )}
          </div>

          <Input id="assignWorkload" type="number" label="月間工数（時間）" value={assignForm.workloadHours}
            onChange={(e) => setAssignForm(f => ({ ...f, workloadHours: e.target.value }))} />
          <Input id="assignStartDate" type="date" label="開始日 *" value={assignForm.startDate}
            onChange={(e) => setAssignForm(f => ({ ...f, startDate: e.target.value }))} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); setAssignError(""); }}>キャンセル</Button>
            <Button variant="primary" onClick={handleAddAssignment} disabled={assignSaving}>
              {assignSaving ? "登録中..." : "登録"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
