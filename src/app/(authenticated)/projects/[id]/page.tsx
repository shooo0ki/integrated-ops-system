"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "@/frontend/components/common/prefetch-link";
import { ArrowLeft, Users, Calendar, DollarSign, Plus, Trash2, Pencil, Check, X, UserPlus, ExternalLink } from "lucide-react";
import { Badge } from "@/frontend/components/common/badge";
import { Button } from "@/frontend/components/common/button";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Modal } from "@/frontend/components/common/modal";
import { Input, Select } from "@/frontend/components/common/input";
import { useAuth } from "@/frontend/contexts/auth-context";
import { DetailPageSkeleton } from "@/frontend/components/common/skeleton";
import { formatDate, formatCurrency, toJSTDateString } from "@/shared/utils";
import { PROJECT_STATUS_LABELS as STATUS_LABELS, PROJECT_STATUS_COLORS as STATUS_COLOR, CONTRACT_TYPE_LABELS as CONTRACT_LABELS } from "@/frontend/constants/projects";

// ─── 型定義 ──────────────────────────────────────────────

interface Position {
  id: string;
  positionName: string;
  requiredCount: number;
  assignmentCount: number;
}

interface MonthlyHour {
  id: string;
  targetMonth: string;
  workloadHours: number;
}

interface Assignment {
  id: string;
  memberId: string | null;
  memberName: string | null;
  positionName: string;
  positionId: string;
  workloadHours: number;
  startDate: string;
  endDate: string | null;
  monthlyHours: MonthlyHour[];
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

function toDateInput(d: string | null): string {
  if (!d) return "";
  return toJSTDateString(new Date(d));
}

/** プロジェクト期間から月リストを生成 */
function getProjectMonths(startDate: string, endDate: string | null): string[] {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  // 最大24ヶ月
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last && months.length < 24) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// ─── ページ ───────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { role } = useAuth();
  const canManage = role === "admin" || role === "manager";

  const { data: project, isLoading: loading, error: projectError, mutate: mutateProject } = useSWR<ProjectDetail>(
    `/api/projects/${id}`
  );
  const { data: membersData } = useSWR<{ members?: MemberOption[] } | MemberOption[]>("/api/members");
  const members: MemberOption[] = membersData
    ? ((membersData as { members?: MemberOption[] }).members ?? (membersData as MemberOption[]))
    : [];

  // プロジェクト編集
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({
    name: "", description: "", status: "active",
    clientName: "", contractType: "", monthlyContractAmount: "",
    startDate: "", endDate: "",
  });

  // プロジェクト削除
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // アサイン管理
  const [addOpen, setAddOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ memberId: "", positionId: "", workloadHours: "80", startDate: "" });
  const [positionMode, setPositionMode] = useState<"existing" | "new">("existing");
  const [newPositionName, setNewPositionName] = useState("");

  // メンバー差替え
  const [swapAssignId, setSwapAssignId] = useState<string | null>(null);
  const [swapMemberId, setSwapMemberId] = useState("");
  const [swapping, setSwapping] = useState(false);

  // 月別稼働編集
  const [editingMonthly, setEditingMonthly] = useState<{ assignId: string; month: string } | null>(null);
  const [monthlyValue, setMonthlyValue] = useState("");
  const [savingMonthly, setSavingMonthly] = useState(false);

  useEffect(() => {
    setAssignForm((prev) => ({ ...prev, startDate: toJSTDateString() }));
  }, []);

  useEffect(() => {
    if (projectError) { router.push("/projects"); }
  }, [projectError, router]);

  useEffect(() => {
    if (!project || editing) return;
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
  }, [project, editing]);

  const projectMonths = useMemo(() => {
    if (!project) return [];
    return getProjectMonths(project.startDate, project.endDate);
  }, [project]);

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
      await mutateProject();
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
    setAssignForm({ memberId: "", positionId: "", workloadHours: "80", startDate: toJSTDateString() });
    setAddOpen(true);
  }

  async function handleAddAssignment() {
    if (!assignForm.startDate) {
      setAssignError("開始日を入力してください");
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
        memberId: assignForm.memberId || null,
        workloadHours: Number(assignForm.workloadHours),
        startDate: assignForm.startDate,
      }),
    });
    setAssignSaving(false);
    if (res.ok) {
      await mutateProject();
      setAddOpen(false);
    } else {
      let msg = "登録に失敗しました";
      try { const d = await res.json(); msg = d.error?.message ?? msg; } catch {}
      setAssignError(msg);
    }
  }

  async function handleDeleteProject() {
    setDeletingProject(true);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setDeletingProject(false);
    if (res.ok) {
      router.push("/projects");
    } else {
      setDeleteProjectOpen(false);
      setSaveMsg("削除に失敗しました");
    }
  }

  async function handleDeleteAssignment(assignId: string) {
    setDeleteId(assignId);
    const res = await fetch(`/api/projects/${id}/assignments/${assignId}`, { method: "DELETE" });
    setDeleteId(null);
    if (res.ok) await mutateProject();
  }

  // ─── メンバー差替え ────────────────────────────────────

  async function handleSwapMember() {
    if (!swapAssignId) return;
    setSwapping(true);
    const res = await fetch(`/api/projects/${id}/assignments/${swapAssignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: swapMemberId || null }),
    });
    setSwapping(false);
    if (res.ok) {
      await mutateProject();
      setSwapAssignId(null);
      setSwapMemberId("");
    }
  }

  // ─── 月別稼働 ──────────────────────────────────────────

  async function handleSaveMonthly() {
    if (!editingMonthly) return;
    setSavingMonthly(true);
    await fetch(`/api/projects/${id}/assignments/${editingMonthly.assignId}/monthly`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMonth: editingMonthly.month,
        workloadHours: Number(monthlyValue) || 0,
      }),
    });
    setSavingMonthly(false);
    setEditingMonthly(null);
    await mutateProject();
  }

  function getMonthlyHours(assignment: Assignment, month: string): number {
    const mh = assignment.monthlyHours.find((m) => m.targetMonth === month);
    return mh ? mh.workloadHours : assignment.workloadHours;
  }

  // ─── レンダー ─────────────────────────────────────────

  if (loading) return <DetailPageSkeleton rows={5} cols={5} />;
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
                <input type="text" value={form.name} onChange={set("name")} className="w-full" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">説明</label>
                <textarea value={form.description} onChange={set("description")} rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ステータス</label>
                <Select value={form.status} onChange={set("status")} className="w-full">
                  <option value="planning">計画中</option>
                  <option value="active">進行中</option>
                  <option value="on_hold">一時停止</option>
                  <option value="completed">完了</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">クライアント名</label>
                <input type="text" value={form.clientName} onChange={set("clientName")} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">契約種別</label>
                <Select value={form.contractType} onChange={set("contractType")} className="w-full">
                  <option value="">未設定</option>
                  <option value="quasi_mandate">準委任</option>
                  <option value="contract">請負</option>
                  <option value="in_house">自社開発</option>
                  <option value="other">その他</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">月額契約金額（円）</label>
                <input type="number" min={0} value={form.monthlyContractAmount} onChange={set("monthlyContractAmount")} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">開始日</label>
                <input type="date" value={form.startDate} onChange={set("startDate")} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">終了日（任意）</label>
                <input type="date" value={form.endDate} onChange={set("endDate")} className="w-full" />
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil size={14} /> 編集
                  </Button>
                  {role === "admin" && (
                    <Button variant="outline" size="sm" onClick={() => setDeleteProjectOpen(true)}
                      className="text-red-600 hover:border-red-300 hover:bg-red-50">
                      <Trash2 size={14} /> 削除
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Calendar size={14} className="text-slate-400" />
                {formatDate(project.startDate)}{project.endDate ? ` 〜 ${formatDate(project.endDate)}` : " 〜"}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Users size={14} className="text-slate-400" /> {project.assignments.filter(a => a.memberId).length}名アサイン
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
          <div className="flex items-center gap-2">
            <Link
              href="/skills"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <ExternalLink size={12} /> スキルマトリクス
            </Link>
            {canManage && (
              <Button variant="primary" size="sm" onClick={openAddModal}>
                <Plus size={14} /> 追加
              </Button>
            )}
          </div>
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
                  {canManage && <th className="py-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {project.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2">
                      {a.memberId && a.memberName ? (
                        <Link href={`/members/${a.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">
                          {a.memberName}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 italic">
                          未アサイン
                          {canManage && (
                            <button
                              onClick={() => { setSwapAssignId(a.id); setSwapMemberId(""); }}
                              className="text-blue-500 hover:text-blue-700"
                              title="メンバーをアサイン"
                            >
                              <UserPlus size={13} />
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-slate-500">{a.positionName}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{a.workloadHours}h/月</td>
                    <td className="py-2 text-xs text-slate-400">{formatDate(a.startDate)}</td>
                    {canManage && (
                      <td className="py-2 text-right flex items-center justify-end gap-1">
                        {a.memberId && (
                          <button
                            onClick={() => { setSwapAssignId(a.id); setSwapMemberId(a.memberId ?? ""); }}
                            className="p-1 text-slate-300 hover:text-blue-500"
                            title="メンバー変更"
                          >
                            <UserPlus size={13} />
                          </button>
                        )}
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

      {/* ─ 月別稼働時間テーブル ─ */}
      {project.assignments.length > 0 && projectMonths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>月別稼働時間（h）</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="py-2 text-left font-medium sticky left-0 bg-white z-10 min-w-[120px]">メンバー</th>
                  {projectMonths.map((m) => (
                    <th key={m} className="py-2 text-center font-medium min-w-[60px]">
                      {m.slice(5)}月
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {project.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2 sticky left-0 bg-white z-10">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{a.memberName ?? "未アサイン"}</span>
                        <span className="text-xs text-slate-400">{a.positionName}</span>
                      </div>
                    </td>
                    {projectMonths.map((m) => {
                      const hours = getMonthlyHours(a, m);
                      const isEditing = editingMonthly?.assignId === a.id && editingMonthly?.month === m;
                      const isCustom = a.monthlyHours.some((mh) => mh.targetMonth === m);
                      return (
                        <td key={m} className="py-2 text-center">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                type="number"
                                value={monthlyValue}
                                onChange={(e) => setMonthlyValue(e.target.value)}
                                className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center text-xs"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveMonthly();
                                  if (e.key === "Escape") setEditingMonthly(null);
                                }}
                              />
                              <button onClick={handleSaveMonthly} disabled={savingMonthly}
                                className="text-green-600 hover:text-green-800"><Check size={12} /></button>
                              <button onClick={() => setEditingMonthly(null)}
                                className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (!canManage) return;
                                setEditingMonthly({ assignId: a.id, month: m });
                                setMonthlyValue(String(hours));
                              }}
                              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                canManage ? "hover:bg-blue-50 cursor-pointer" : "cursor-default"
                              } ${isCustom ? "font-semibold text-blue-700" : "text-slate-600"}`}
                            >
                              {hours}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">クリックで月別の稼働時間を変更できます。太字は個別設定値です。</p>
        </Card>
      )}

      {/* ─ プロジェクト削除確認モーダル ─ */}
      <Modal isOpen={deleteProjectOpen} onClose={() => setDeleteProjectOpen(false)} title="プロジェクトを削除">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            プロジェクト「<span className="font-semibold">{project.name}</span>」を削除しますか？
          </p>
          <p className="text-xs text-slate-400">この操作は元に戻せません。</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setDeleteProjectOpen(false)} disabled={deletingProject}>
              キャンセル
            </Button>
            <Button
              variant="outline"
              onClick={handleDeleteProject}
              disabled={deletingProject}
              className="border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
            >
              <Trash2 size={14} /> {deletingProject ? "削除中..." : "削除する"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─ アサイン追加モーダル ─ */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setAssignError(""); }} title="メンバーをアサイン">
        <div className="space-y-3">
          {assignError && <p className="text-xs text-red-600">{assignError}</p>}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">メンバー（空欄=未アサイン枠）</label>
              <Link
                href="/skills"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
              >
                <ExternalLink size={11} /> スキルを確認
              </Link>
            </div>
            <Select id="assignMemberId" value={assignForm.memberId}
              onChange={(e) => setAssignForm(f => ({ ...f, memberId: e.target.value }))}>
              <option value="">未アサイン（後で割り当て）</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.company === "boost" ? "Boost" : "SALT2"}）
                </option>
              ))}
            </Select>
          </div>

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

      {/* ─ メンバー差替えモーダル ─ */}
      <Modal isOpen={!!swapAssignId} onClose={() => setSwapAssignId(null)} title="メンバー変更">
        <div className="space-y-3">
          <Select id="swapMemberId" label="新しいメンバー" value={swapMemberId}
            onChange={(e) => setSwapMemberId(e.target.value)}>
            <option value="">未アサインに戻す</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.company === "boost" ? "Boost" : "SALT2"}）
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSwapAssignId(null)}>キャンセル</Button>
            <Button variant="primary" onClick={handleSwapMember} disabled={swapping}>
              {swapping ? "変更中..." : "変更する"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
