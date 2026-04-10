"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "@/frontend/components/common/prefetch-link";
import { Wrench, Plus, TrendingUp, Edit2, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Button } from "@/frontend/components/common/button";
import { Modal } from "@/frontend/components/common/modal";
import { Input, Select } from "@/frontend/components/common/input";
import { CurrencyInput } from "@/frontend/components/common/currency-input";
import { formatCurrency, formatDate } from "@/shared/utils";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";

interface ToolEntry {
  id: string;
  memberId: string;
  memberName: string;
  toolName: string;
  plan: string | null;
  monthlyCost: number;
  note: string | null;
  updatedAt: string;
}

interface MemberOption {
  id: string;
  name: string;
}

export default function ToolsPage() {
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [toolFilter, setToolFilter] = useState<string>("ALL");

  const { data: tools = [], isLoading: toolsLoading, mutate: mutateTools } = useSWR<ToolEntry[]>("/api/tools");
  const { data: membersData, isLoading: membersLoading } = useSWR<{ members?: MemberOption[] } | MemberOption[]>("/api/members");
  const loading = toolsLoading || membersLoading;
  const members: MemberOption[] = membersData
    ? ((membersData as { members?: MemberOption[] }).members ?? (membersData as MemberOption[])).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }))
    : [];

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ToolEntry | null>(null);
  const [form, setForm] = useState({ toolName: "", plan: "", monthlyCost: "", memberIds: [] as string[], note: "" });
  const [editForm, setEditForm] = useState({ plan: "", monthlyCost: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const toolNames = Array.from(new Set(tools.map((t) => t.toolName))).sort();

  const filtered = tools.filter((t) => {
    const matchMember = memberFilter === "ALL" || t.memberId === memberFilter;
    const matchTool = toolFilter === "ALL" || t.toolName === toolFilter;
    return matchMember && matchTool;
  });

  const totalCost = filtered.reduce((s, t) => s + t.monthlyCost, 0);

  const toolSummary = filtered.reduce<Record<string, { count: number; totalCost: number }>>((acc, t) => {
    if (!acc[t.toolName]) acc[t.toolName] = { count: 0, totalCost: 0 };
    acc[t.toolName].count++;
    acc[t.toolName].totalCost += t.monthlyCost;
    return acc;
  }, {});

  function toggleMember(id: string) {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(id)
        ? f.memberIds.filter((mid) => mid !== id)
        : [...f.memberIds, id],
    }));
  }

  async function handleAdd() {
    if (form.memberIds.length === 0 || !form.toolName) return;
    setSubmitting(true);
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberIds: form.memberIds,
        toolName: form.toolName,
        plan: form.plan || undefined,
        monthlyCost: form.monthlyCost ? Number(form.monthlyCost) : 0,
        note: form.note || undefined,
      }),
    });
    if (res.ok) {
      await mutateTools();
      setAddOpen(false);
      setForm({ toolName: "", plan: "", monthlyCost: "", memberIds: [], note: "" });
      setMemberSearch("");
    }
    setSubmitting(false);
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setSubmitting(true);
    const res = await fetch(`/api/members/${editTarget.memberId}/tools/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName: editTarget.toolName,
        plan: editForm.plan || null,
        monthlyCost: editForm.monthlyCost ? Number(editForm.monthlyCost) : editTarget.monthlyCost,
        note: editForm.note || null,
      }),
    });
    if (res.ok) {
      await mutateTools();
      setEditTarget(null);
    }
    setSubmitting(false);
  }

  async function handleDelete(tool: ToolEntry) {
    if (!confirm(`「${tool.toolName}」を削除しますか？`)) return;
    const res = await fetch(`/api/members/${tool.memberId}/tools/${tool.id}`, { method: "DELETE" });
    if (res.ok) {
      await mutateTools();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ツール管理</h1>
          <p className="text-sm text-slate-500">SaaSサブスクリプション・コスト管理</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> ツール追加
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-slate-500">表示中合計/月</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalCost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">ツール種別数</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{Object.keys(toolSummary).length}</p>
        </Card>
      </div>

      {/* Tool cost breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>ツール別コスト（表示中）</CardTitle>
          <TrendingUp size={16} className="text-slate-400" />
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {Object.entries(toolSummary)
            .sort((a, b) => b[1].totalCost - a[1].totalCost)
            .map(([name, { count, totalCost: tc }]) => (
              <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{name}</span>
                <span className="ml-2 text-slate-400 text-xs">{count}名</span>
                <span className="ml-2 font-semibold text-blue-700">{formatCurrency(tc)}/月</span>
              </div>
            ))}
          {Object.keys(toolSummary).length === 0 && (
            <p className="text-sm text-slate-400">該当なし</p>
          )}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
        >
          <option value="ALL">全ツール</option>
          {toolNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
        <Select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
        >
          <option value="ALL">全メンバー</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <InlineSkeleton />
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">メンバー</th>
                  <th className="px-4 py-3 text-left font-medium">ツール名</th>
                  <th className="px-4 py-3 text-left font-medium">プラン</th>
                  <th className="px-4 py-3 text-right font-medium">月額</th>
                  <th className="px-4 py-3 text-left font-medium">備考</th>
                  <th className="px-4 py-3 text-left font-medium">更新日</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tool) => (
                  <tr key={tool.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/members/${tool.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">
                        {tool.memberName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{tool.toolName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{tool.plan ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {tool.monthlyCost === 0 ? (
                        <span className="text-slate-400">無料</span>
                      ) : (
                        <span className="font-semibold text-slate-800">{formatCurrency(tool.monthlyCost)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[120px] truncate">{tool.note ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(tool.updatedAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditTarget(tool);
                            setEditForm({ plan: tool.plan ?? "", monthlyCost: String(tool.monthlyCost), note: tool.note ?? "" });
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(tool)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              <Wrench size={24} className="mx-auto mb-2 text-slate-300" />
              該当するツールがありません
            </div>
          )}
        </Card>
      )}

      {/* Add modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="ツール追加">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              メンバー *（{form.memberIds.length}名選択中）
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="名前で検索..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const filtered = members.filter((m) =>
                    !memberSearch || m.name.includes(memberSearch)
                  );
                  const allSelected = filtered.every((m) => form.memberIds.includes(m.id));
                  setForm((f) => ({
                    ...f,
                    memberIds: allSelected
                      ? f.memberIds.filter((id) => !filtered.some((m) => m.id === id))
                      : Array.from(new Set([...f.memberIds, ...filtered.map((m) => m.id)])),
                  }));
                }}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                全選択/解除
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {members
                .filter((m) => !memberSearch || m.name.includes(memberSearch))
                .map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.memberIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{m.name}</span>
                  </label>
                ))}
              {members.filter((m) => !memberSearch || m.name.includes(memberSearch)).length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">該当なし</p>
              )}
            </div>
          </div>
          <Input id="toolName" label="ツール名 *" value={form.toolName} onChange={(e) => setForm((f) => ({ ...f, toolName: e.target.value }))} placeholder="Claude" />
          <Input id="plan" label="プラン" value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} placeholder="Pro" />
          <CurrencyInput id="monthlyCost" label="月額（円）" value={form.monthlyCost} onChange={(v) => setForm((f) => ({ ...f, monthlyCost: v }))} placeholder="3,200" />
          <Input id="note" label="備考" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="用途など" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>キャンセル</Button>
            <Button variant="primary" onClick={handleAdd} disabled={submitting || form.memberIds.length === 0 || !form.toolName}>
              {submitting ? "追加中..." : `${form.memberIds.length}名に追加`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`編集: ${editTarget?.toolName}`}>
        {editTarget && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              メンバー: <span className="font-medium">{editTarget.memberName}</span>
            </div>
            <Input id="editPlan" label="プラン" value={editForm.plan} onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))} />
            <CurrencyInput id="editCost" label="月額（円）" value={editForm.monthlyCost} onChange={(v) => setEditForm((f) => ({ ...f, monthlyCost: v }))} />
            <Input id="editNote" label="備考" value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>キャンセル</Button>
              <Button variant="primary" onClick={handleEditSave} disabled={submitting}>{submitting ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
