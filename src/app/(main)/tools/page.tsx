"use client";

import { useState } from "react";
import Link from "next/link";
import { Wrench, Plus, TrendingUp, Edit2, Trash2 } from "lucide-react";
import {
  SAAS_TOOLS, MEMBERS, formatCurrency, formatDate,
  type Company, type SaasTool,
} from "@/lib/mock-data";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";

export default function ToolsPage() {
  const [companyFilter, setCompanyFilter] = useState<Company | "ALL">("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [toolFilter, setToolFilter] = useState<string>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SaasTool | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ toolName: "", plan: "", monthlyCost: "", companyLabel: "Boost" as Company, memberId: "", note: "" });

  const tools = SAAS_TOOLS.filter((t) => !deletedIds.has(t.id));
  const toolNames = Array.from(new Set(SAAS_TOOLS.map((t) => t.toolName))).sort();

  const filtered = tools.filter((t) => {
    const matchCompany = companyFilter === "ALL" || t.companyLabel === companyFilter;
    const matchMember = memberFilter === "ALL" || t.memberId === memberFilter;
    const matchTool = toolFilter === "ALL" || t.toolName === toolFilter;
    return matchCompany && matchMember && matchTool;
  });

  // KPIs
  const totalCost = filtered.reduce((s, t) => s + t.monthlyCost, 0);
  const boostCost = tools.filter((t) => t.companyLabel === "Boost").reduce((s, t) => s + t.monthlyCost, 0);
  const salt2Cost = tools.filter((t) => t.companyLabel === "SALT2").reduce((s, t) => s + t.monthlyCost, 0);

  // Group by tool name for summary
  const toolSummary = filtered.reduce<Record<string, { count: number; totalCost: number }>>((acc, t) => {
    if (!acc[t.toolName]) acc[t.toolName] = { count: 0, totalCost: 0 };
    acc[t.toolName].count++;
    acc[t.toolName].totalCost += t.monthlyCost;
    return acc;
  }, {});

  function handleAdd() {
    setAddOpen(false);
    setForm({ toolName: "", plan: "", monthlyCost: "", companyLabel: "Boost", memberId: "", note: "" });
  }

  function handleDelete(id: string) {
    setDeletedIds((prev) => new Set(Array.from(prev).concat(id)));
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
          {toolNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value as Company | "ALL")}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全社</option>
          <option value="Boost">Boost</option>
          <option value="SALT2">SALT2</option>
        </select>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全メンバー</option>
          {MEMBERS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
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
                    {tool.memberId === "mSALT2" ? (
                      <span className="font-medium text-slate-600">{tool.memberName}</span>
                    ) : (
                      <Link href={`/members/${tool.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">
                        {tool.memberName}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{tool.toolName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{tool.plan}</td>
                  <td className="px-4 py-2.5 text-right">
                    {tool.monthlyCost === 0 ? (
                      <span className="text-slate-400">無料</span>
                    ) : (
                      <span className="font-semibold text-slate-800">{formatCurrency(tool.monthlyCost)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={tool.companyLabel === "Boost" ? "boost" : "salt2"}>
                      {tool.companyLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[120px] truncate">{tool.note ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(tool.updatedAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditTarget(tool)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(tool.id)}
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

      {/* Add modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="ツール追加">
        <div className="space-y-3">
          <Select
            id="memberId" label="メンバー *"
            value={form.memberId}
            onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
          >
            <option value="">選択してください</option>
            {MEMBERS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <Input id="toolName" label="ツール名 *" value={form.toolName} onChange={(e) => setForm((f) => ({ ...f, toolName: e.target.value }))} placeholder="Claude" />
          <Input id="plan" label="プラン" value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} placeholder="Pro" />
          <Input id="monthlyCost" type="number" label="月額（円）" value={form.monthlyCost} onChange={(e) => setForm((f) => ({ ...f, monthlyCost: e.target.value }))} placeholder="3200" />
          <Select id="companyLabel" label="請求先 *" value={form.companyLabel} onChange={(e) => setForm((f) => ({ ...f, companyLabel: e.target.value as Company }))}>
            <option value="Boost">Boost</option>
            <option value="SALT2">SALT2</option>
          </Select>
          <Input id="note" label="備考" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="用途など" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>キャンセル</Button>
            <Button variant="primary" onClick={handleAdd}>追加（デモ）</Button>
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
            <Input id="editPlan" label="プラン" defaultValue={editTarget.plan} />
            <Input id="editCost" type="number" label="月額（円）" defaultValue={String(editTarget.monthlyCost)} />
            <Input id="editNote" label="備考" defaultValue={editTarget.note ?? ""} />
            <p className="text-xs text-amber-600">※ デモのため実際には保存されません</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>キャンセル</Button>
              <Button variant="primary" onClick={() => setEditTarget(null)}>保存（デモ）</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
