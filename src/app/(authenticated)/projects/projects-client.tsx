"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import Link from "@/frontend/components/common/prefetch-link";
import { Select, Input } from "@/frontend/components/common/input";
import { Button } from "@/frontend/components/common/button";
import { Modal } from "@/frontend/components/common/modal";
import { TablePageSkeleton } from "@/frontend/components/common/skeleton";
import { ConfirmDialog } from "@/frontend/components/common/confirm-dialog";
import { formatDate, formatCurrency } from "@/shared/utils";
import { PROJECT_STATUS_LABELS as STATUS_LABELS, companyDisplay } from "@/frontend/constants/projects";
import { CurrencyInput } from "@/frontend/components/common/currency-input";
import { EmptyState } from "@/frontend/components/common/empty-state";

interface Assignment {
  id: string;
  memberId: string | null;
  memberName: string | null;
  positionName: string;
  workloadHours: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  company: string;
  startDate: string;
  endDate: string | null;
  clientName: string | null;
  contractType: string | null;
  monthlyContractAmount: number;
  assignments: Assignment[];
}

interface PositionInput {
  positionName: string;
  requiredCount: string;
}

interface MemberOption {
  id: string;
  name: string;
  company: string;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  quasi_mandate: "準委任",
  contract: "請負",
  in_house: "自社開発",
  other: "その他",
};

export default function ProjectsClient({ role }: { role: string }) {
  const router = useRouter();
  const isPrivileged = role === "admin" || role === "manager";
  const canCreate = true; // 全ロールが案件登録可能（2-2-1）

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const params = new URLSearchParams();
  if (companyFilter) params.set("company", companyFilter);
  if (statusFilter) params.set("status", statusFilter);
  const swrKey = `/api/projects?${params}`;

  const { data: projects = [], isLoading: loading, mutate } = useSWR<Project[]>(swrKey);
  const { data: membersData } = useSWR<{ members?: MemberOption[] } | MemberOption[]>("/api/members");
  const members: MemberOption[] = membersData
    ? ((membersData as { members?: MemberOption[] }).members ?? (membersData as MemberOption[]))
    : [];

  // ─── 新規登録モーダル ───────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    name: "", description: "", status: "active", company: "boost",
    startDate: "", endDate: "", clientName: "", contractType: "quasi_mandate",
    monthlyContractAmount: "",
  });
  const [noDeadline, setNoDeadline] = useState(false);
  const [positions, setPositions] = useState<PositionInput[]>([
    { positionName: "PM", requiredCount: "1" },
    { positionName: "", requiredCount: "1" },
  ]);
  // 初期アサイン（ポジションindex -> memberId）
  const [initialAssigns, setInitialAssigns] = useState<Record<number, string>>({});

  function resetForm() {
    setForm({
      name: "", description: "", status: "active", company: "boost",
      startDate: "", endDate: "", clientName: "", contractType: "quasi_mandate",
      monthlyContractAmount: "",
    });
    setNoDeadline(false);
    setPositions([{ positionName: "PM", requiredCount: "1" }, { positionName: "", requiredCount: "1" }]);
    setInitialAssigns({});
    setCreateError("");
  }

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }
  function setPos(i: number, k: keyof PositionInput, v: string) {
    setPositions((p) => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.startDate) {
      setCreateError("プロジェクト名と開始日は必須です");
      return;
    }
    setSubmitting(true);
    setCreateError("");

    const validPositions = positions.filter((p) => p.positionName.trim());

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        status: form.status,
        company: form.company,
        startDate: form.startDate,
        endDate: noDeadline || !form.endDate ? null : form.endDate,
        clientName: form.clientName || undefined,
        contractType: form.contractType || undefined,
        monthlyContractAmount: form.monthlyContractAmount ? Number(form.monthlyContractAmount) : 0,
        positions: validPositions.map((p) => ({
          positionName: p.positionName,
          requiredCount: Number(p.requiredCount) || 1,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setCreateError(data?.error?.message ?? "登録に失敗しました");
      setSubmitting(false);
      return;
    }

    const project = await res.json();

    // 初期アサインがあれば登録
    for (const [posIdx, memberId] of Object.entries(initialAssigns)) {
      if (!memberId) continue;
      const posName = positions[Number(posIdx)]?.positionName?.trim();
      if (!posName) continue;

      const detailRes = await fetch(`/api/projects/${project.id}`);
      if (!detailRes.ok) break;
      const detail = await detailRes.json();
      const pos = detail.positions?.find((p: { positionName: string }) => p.positionName === posName);
      if (!pos) continue;

      await fetch(`/api/projects/${project.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: pos.id,
          memberId,
          workloadHours: 80,
          startDate: form.startDate,
        }),
      });
    }

    setSubmitting(false);
    setCreateOpen(false);
    resetForm();
    // 一覧キャッシュを更新してから詳細ページへ遷移
    await mutate();
    router.push(`/projects/${project.id}`);
  }

  async function handleDelete(projectId: string) {
    // 即座にリストから除外
    const prev = projects;
    mutate(
      current => current ? current.filter(p => p.id !== projectId) : [],
      { revalidate: false }
    );
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      // 成功: サーバーの実データで確定
      mutate();
    } else {
      // 失敗: 元データに戻す
      mutate(prev, { revalidate: false });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">プロジェクトサマリー</h1>
          <p className="text-sm text-slate-500">{projects.length}件</p>
        </div>
        {canCreate && (
          <a
            href="/projects/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} /> 新規登録
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全ステータス</option>
          <option value="active">進行中</option>
          <option value="planning">計画中</option>
          <option value="completed">完了</option>
          <option value="on_hold">一時停止</option>
        </Select>
      </div>

      {/* Project table */}
      {loading ? (
        <TablePageSkeleton rows={6} cols={6} />
      ) : projects.length === 0 ? (
        <EmptyState title="該当するプロジェクトがありません" action={{ label: "新規作成", href: "/projects/new" }} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">プロジェクト名</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">会社</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">ステータス</th>
                {isPrivileged && <th className="px-4 py-2.5 text-right font-medium text-slate-500">月額契約</th>}
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">開始日</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-500">メンバー</th>
                {canCreate && <th className="px-4 py-2.5 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/projects/${p.id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                      {p.name}
                    </Link>
                    {p.clientName && <span className="ml-2 text-xs text-slate-400">{p.clientName}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{companyDisplay(p.company)}</td>
                  <td className="px-4 py-2.5">
                    {canCreate ? (
                      <select
                        value={p.status}
                        onChange={async (e) => {
                          await fetch(`/api/projects/${p.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: e.target.value }),
                          });
                          mutate();
                        }}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-700">{STATUS_LABELS[p.status] ?? p.status}</span>
                    )}
                  </td>
                  {isPrivileged && <td className="px-4 py-2.5 text-right text-slate-800">{formatCurrency(p.monthlyContractAmount)}</td>}
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(p.startDate)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.assignments.length > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}>
                      {p.assignments.length}名
                    </span>
                  </td>
                  {canCreate && (
                    <td className="px-2 py-2.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.id); }}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 新規登録モーダル ─── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="プロジェクト登録" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {createError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{createError}</p>
          )}

          {/* 基本情報 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input id="create-name" label="プロジェクト名 *" value={form.name}
                onChange={(e) => set("name", e.target.value)} placeholder="〇〇社 AI 開発" />
            </div>
            <Select id="create-company" label="会社 *" value={form.company}
              onChange={(e) => set("company", e.target.value)}>
              <option value="boost">Boost</option>
              <option value="salt2">SALT2</option>
            </Select>
            <Select id="create-status" label="ステータス" value={form.status}
              onChange={(e) => set("status", e.target.value)}>
              <option value="active">進行中</option>
              <option value="planning">計画中</option>
              <option value="on_hold">一時停止</option>
              <option value="completed">完了</option>
            </Select>
            <Input id="create-startDate" type="date" label="開始日 *" value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)} />
            <div>
              {!noDeadline && (
                <Input id="create-endDate" type="date" label="終了日（予定）" value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)} />
              )}
              <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={noDeadline}
                  onChange={(e) => { setNoDeadline(e.target.checked); if (e.target.checked) set("endDate", ""); }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                期限なし
              </label>
            </div>
            <Input id="create-clientName" label="クライアント名" value={form.clientName}
              onChange={(e) => set("clientName", e.target.value)} placeholder="株式会社〇〇" />
            <Select id="create-contractType" label="契約形態" value={form.contractType}
              onChange={(e) => set("contractType", e.target.value)}>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
            <CurrencyInput id="create-amount" label="月額契約金額（円）" value={form.monthlyContractAmount} onChange={(v) => set("monthlyContractAmount", v)} placeholder="500,000" />
          </div>

          {/* 説明 */}
          <div>
            <label className="text-sm font-medium text-slate-700">説明</label>
            <textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="プロジェクトの概要" />
          </div>

          {/* ポジション + 初期アサイン */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">想定メンバー</label>
              <button type="button" onClick={() => setPositions((p) => [...p, { positionName: "", requiredCount: "1" }])}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus size={13} /> 追加
              </button>
            </div>
            <div className="space-y-2">
              {positions.map((pos, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-[1fr_60px] gap-2">
                    <Input id={`pos-name-${i}`} placeholder="ポジション名" value={pos.positionName}
                      onChange={(e) => setPos(i, "positionName", e.target.value)} />
                    <Input id={`pos-count-${i}`} type="number" placeholder="人数" value={pos.requiredCount}
                      onChange={(e) => setPos(i, "requiredCount", e.target.value)} />
                  </div>
                  {/* 初期アサインメンバー選択 */}
                  {pos.positionName.trim() && (
                    <select
                      value={initialAssigns[i] ?? ""}
                      onChange={(e) => setInitialAssigns((prev) => ({ ...prev, [i]: e.target.value }))}
                      className="w-36 rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-600"
                    >
                      <option value="">未アサイン</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={() => {
                    setPositions((p) => p.filter((_, idx) => idx !== i));
                    setInitialAssigns((prev) => {
                      const next = { ...prev };
                      delete next[i];
                      return next;
                    });
                  }} className="mt-2 text-slate-400 hover:text-red-500 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>キャンセル</Button>
            <Button variant="primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? "登録中..." : "登録する"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="プロジェクトを削除"
        description="この操作は取り消せません。本当に削除しますか？"
        confirmLabel="削除する"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
