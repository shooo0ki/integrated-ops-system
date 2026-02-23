"use client";

import { useState } from "react";
import Link from "next/link";
import { FileCheck, Send, Clock, CheckCircle, XCircle, FilePlus } from "lucide-react";
import {
  CONTRACT_RECORDS, MEMBERS, formatDate, getContractStatusLabel,
  type Company, type ContractStatus, type ContractRecord,
} from "@/lib/mock-data";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const STATUS_ORDER: ContractStatus[] = ["draft", "sent", "waiting_sign", "completed", "voided"];

const statusConfig: Record<ContractStatus, { label: string; variant: "default" | "info" | "warning" | "success" | "danger"; icon: React.ReactNode }> = {
  draft:        { label: "下書き",    variant: "default",  icon: <FileCheck size={14} /> },
  sent:         { label: "送付済",    variant: "info",     icon: <Send size={14} /> },
  waiting_sign: { label: "署名待ち",  variant: "warning",  icon: <Clock size={14} /> },
  completed:    { label: "締結完了",  variant: "success",  icon: <CheckCircle size={14} /> },
  voided:       { label: "無効",      variant: "danger",   icon: <XCircle size={14} /> },
};

// Flow steps display
const FLOW_STEPS: { key: ContractStatus; label: string }[] = [
  { key: "draft", label: "下書き" },
  { key: "sent", label: "送付済" },
  { key: "waiting_sign", label: "署名待ち" },
  { key: "completed", label: "締結完了" },
];

function StatusFlow({ current }: { current: ContractStatus }) {
  const activeIdx = FLOW_STEPS.findIndex((s) => s.key === current);
  if (current === "voided") {
    return <Badge variant="danger">無効</Badge>;
  }
  return (
    <div className="flex items-center gap-1">
      {FLOW_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              i < activeIdx
                ? "bg-slate-200 text-slate-500"
                : i === activeIdx
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {step.label}
          </span>
          {i < FLOW_STEPS.length - 1 && (
            <span className={`text-xs ${i < activeIdx ? "text-slate-400" : "text-slate-200"}`}>›</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ContractsPage() {
  const [companyFilter, setCompanyFilter] = useState<Company | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = CONTRACT_RECORDS.filter((c) => {
    const matchCompany = companyFilter === "ALL" || c.company === companyFilter;
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchMember = memberFilter === "ALL" || c.memberId === memberFilter;
    return matchCompany && matchStatus && matchMember;
  });

  const selected = CONTRACT_RECORDS.find((c) => c.id === selectedId);

  // Status counts
  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = CONTRACT_RECORDS.filter((c) => c.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">契約管理</h1>
          <p className="text-sm text-slate-500">電子契約・署名ステータス管理</p>
        </div>
        <Button variant="primary" size="sm">
          <FilePlus size={16} /> 新規契約（デモ）
        </Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUS_ORDER.map((s) => {
          const cfg = statusConfig[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "ALL" : s)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                statusFilter === s ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1.5 text-slate-500">
                {cfg.icon}
                <span className="text-xs">{cfg.label}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-800">{counts[s] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Attention: waiting_sign */}
      {counts["waiting_sign"] > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock size={15} className="shrink-0" />
          署名待ちの契約が <strong>{counts["waiting_sign"]}件</strong> あります。リマインドを検討してください。
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "ALL")}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全ステータス</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{getContractStatusLabel(s)}</option>
          ))}
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
                <th className="px-4 py-3 text-left font-medium">テンプレート</th>
                <th className="px-4 py-3 text-left font-medium">会社</th>
                <th className="px-4 py-3 text-left font-medium">進行状況</th>
                <th className="px-4 py-3 text-left font-medium">開始日</th>
                <th className="px-4 py-3 text-left font-medium">終了日</th>
                <th className="px-4 py-3 text-left font-medium">送付日</th>
                <th className="px-4 py-3 text-left font-medium">締結日</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/members/${c.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">
                      {c.memberName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.templateName}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={c.company === "Boost" ? "boost" : "salt2"}>{c.company}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusFlow current={c.status} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{c.startDate ? formatDate(c.startDate) : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{c.endDate ? formatDate(c.endDate) : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{c.sentAt ? formatDate(c.sentAt.slice(0, 10)) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.completedAt ? (
                      <span className="text-green-600 font-medium">{formatDate(c.completedAt.slice(0, 10))}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            <FileCheck size={24} className="mx-auto mb-2 text-slate-300" />
            該当する契約がありません
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelectedId(null)} title="契約詳細" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <StatusFlow current={selected.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">メンバー</p>
                <p className="font-medium">{selected.memberName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">会社</p>
                <Badge variant={selected.company === "Boost" ? "boost" : "salt2"}>{selected.company}</Badge>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400">テンプレート</p>
                <p className="font-medium">{selected.templateName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">開始日</p>
                <p>{selected.startDate ? formatDate(selected.startDate) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">終了日</p>
                <p>{selected.endDate ? formatDate(selected.endDate) : "期限なし"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">署名者メール</p>
                <p className="text-xs">{selected.signerEmail}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">送付日時</p>
                <p className="text-xs">{selected.sentAt ? selected.sentAt.slice(0, 16).replace("T", " ") : "—"}</p>
              </div>
              {selected.completedAt && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">締結日時</p>
                  <p className="text-xs text-green-600 font-medium">{selected.completedAt.slice(0, 16).replace("T", " ")}</p>
                </div>
              )}
            </div>
            {selected.fileUrl && (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <span className="text-sm text-green-700">契約書PDF（署名済）</span>
                <Button variant="outline" size="sm">ダウンロード（デモ）</Button>
              </div>
            )}
            {(selected.status === "sent" || selected.status === "waiting_sign") && (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button variant="outline" size="sm">リマインド送信（デモ）</Button>
                <Button variant="danger" size="sm">無効化（デモ）</Button>
              </div>
            )}
            {selected.status === "draft" && (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <Button variant="primary" size="sm"><Send size={14} />署名依頼を送付（デモ）</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
