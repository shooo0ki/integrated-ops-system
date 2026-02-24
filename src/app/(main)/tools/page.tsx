"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wrench, Plus, TrendingUp, Edit2, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ToolEntry {
  id: string;
  memberId: string;
  memberName: string;
  memberCompany: string;
  toolName: string;
  plan: string | null;
  monthlyCost: number;
  companyLabel: string;
  note: string | null;
  updatedAt: string;
}

interface MemberOption {
  id: string;
  name: string;
  company: string;
}

type Company = "boost" | "salt2";

export default function ToolsPage() {
  const [companyFilter, setCompanyFilter] = useState<Company | "ALL">("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [toolFilter, setToolFilter] = useState<string>("ALL");

  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ToolEntry | null>(null);
  const [form, setForm] = useState({ toolName: "", plan: "", monthlyCost: "", companyLabel: "boost" as Company, memberId: "", note: "" });
  const [editForm, setEditForm] = useState({ plan: "", monthlyCost: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadTools = useCallback(async () => {
    setLoading(true);
    const [toolsRes, membersRes] = await Promise.all([
      fetch("/api/tools"),
      fetch("/api/members"),
    ]);
    if (toolsRes.ok) setTools(await toolsRes.json());
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers((data.members ?? data).map((m: { id: string; name: string; company: string }) => ({ id: m.id, name: m.name, company: m.company })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTools(); }, [loadTools]);

  const toolNames = Array.from(new Set(tools.map((t) => t.toolName))).sort();

  const filtered = tools.filter((t) => {
    const matchCompany = companyFilter === "ALL" || t.companyLabel === companyFilter;
    const matchMember = memberFilter === "ALL" || t.memberId === memberFilter;
    const matchTool = toolFilter === "ALL" || t.toolName === toolFilter;
    return matchCompany && matchMember && matchTool;
  });

  const totalCost = filtered.reduce((s, t) => s + t.monthlyCost, 0);
  const boostCost = tools.filter((t) => t.companyLabel === "boost").reduce((s, t) => s + t.monthlyCost, 0);
  const salt2Cost = tools.filter((t) => t.companyLabel === "salt2").reduce((s, t) => s + t.monthlyCost, 0);

  const toolSummary = filtered.reduce<Record<string, { count: number; totalCost: number }>>((acc, t) => {
    if (!acc[t.toolName]) acc[t.toolName] = { count: 0, totalCost: 0 };
    acc[t.toolName].count++;
    acc[t.toolName].totalCost += t.monthlyCost;
    return acc;
  }, {});

  async function handleAdd() {
    if (!form.memberId || !form.toolName || !form.companyLabel) return;
    setSubmitting(true);
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: form.memberId,
        toolName: form.toolName,
        plan: form.plan || undefined,
        monthlyCost: form.monthlyCost ? Number(form.monthlyCost) : 0,
        companyLabel: form.companyLabel,
        note: form.note || undefined,
      }),
    });
    if (res.ok) {
      const newTool = await res.json();
      setTools((prev) => [...prev, newTool]);
      setAddOpen(false);
      setForm({ toolName: "", plan: "", monthlyCost: "", companyLabel: "boost", memberId: "", note: "" });
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
        companyLabel: editTarget.companyLabel,
        note: editForm.note || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTools((prev) => prev.map((t) => (t.id === editTarget.id ? { ...t, ...updated, memberName: editTarget.memberName, memberCompany: editTarget.memberCompany } : t)));
      setEditTarget(null);
    }
    setSubmitting(false);
  }

  async function handleDelete(tool: ToolEntry) {
    if (!confirm(`「${tool.toolName}」を削除しますか？`)) return;
    const res = await fetch(`/api/members/${tool.memberId}/tools/${tool.id}`, { method: "DELETE" });
    if (res.ok) {
      setTools((prev) => prev.filter((t) => t.id !== tool.id));
    }
  }

  const companyLabelDisplay = (c: string) => c === "boost" ? "Boost" : "SALT2";

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">表示中合計/月</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalCost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Boost 月額合計</p>
          <p className="mt-1 text-xl font-bold text-blue-700">{formatCurrency(boostCost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">SALT2 月額合計</p>
          <p className="mt-1 text-xl font-bold text-green-700">{formatCurrency(salt2Cost)}</p>
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
        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全ツール</option>
          {toolNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value as Company | "ALL")}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </select>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全メンバー</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">メンバー</th>
                  <th className="px-4 py-3 text-left font-medium">ツール名</th>
                  <th className="px-4 py-3 text-left font-medium">プラン</th>
                  <th className="px-4 py-3 text-right font-medium">月額</th>
                  <th className="px-4 py-3 text-left font-medium">請求先</th>
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
                    <td className="px-4 py-2.5">
                      <Badge variant={tool.companyLabel === "boost" ? "boost" : "salt2"}>
                        {companyLabelDisplay(tool.companyLabel)}
                      </Badge>
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
          <Select
            id="memberId" label="メンバー *"
            value={form.memberId}
            onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
          >
            <option value="">選択してください</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Input id="toolName" label="ツール名 *" value={form.toolName} onChange={(e) => setForm((f) => ({ ...f, toolName: e.target.value }))} placeholder="Claude" />
          <Input id="plan" label="プラン" value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} placeholder="Pro" />
          <Input id="monthlyCost" type="number" label="月額（円）" value={form.monthlyCost} onChange={(e) => setForm((f) => ({ ...f, monthlyCost: e.target.value }))} placeholder="3200" />
          <Select id="companyLabel" label="請求先 *" value={form.companyLabel} onChange={(e) => setForm((f) => ({ ...f, companyLabel: e.target.value as Company }))}>
            <option value="boost">Boost</option>
            <option value="salt2">SALT2</option>
          </Select>
          <Input id="note" label="備考" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="用途など" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>キャンセル</Button>
            <Button variant="primary" onClick={handleAdd} disabled={submitting || !form.memberId || !form.toolName}>
              {submitting ? "追加中..." : "追加"}
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
            <Input id="editCost" type="number" label="月額（円）" value={editForm.monthlyCost} onChange={(e) => setEditForm((f) => ({ ...f, monthlyCost: e.target.value }))} />
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
