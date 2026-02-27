"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileCheck, Send, Clock, CheckCircle, XCircle, FilePlus, Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// ─── 型定義 ──────────────────────────────────────────────

type ContractStatus = "draft" | "sent" | "waiting_sign" | "completed" | "voided";

interface ContractRecord {
  id: string;
  memberId: string;
  memberName: string;
  templateName: string;
  docusignTemplateId: string | null;
  status: ContractStatus;
  envelopeId: string | null;
  startDate: string | null;
  endDate: string | null;
  fileUrl: string | null;
  signerEmail: string;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Member {
  id: string;
  name: string;
}

interface DocuSignTemplate {
  templateId: string;
  name: string;
}

// ─── 定数 ────────────────────────────────────────────────

const STATUS_ORDER: ContractStatus[] = ["draft", "sent", "waiting_sign", "completed", "voided"];

const statusConfig: Record<ContractStatus, {
  label: string;
  variant: "default" | "info" | "warning" | "success" | "danger";
  icon: React.ReactNode;
}> = {
  draft:        { label: "下書き",    variant: "default",  icon: <FileCheck size={14} /> },
  sent:         { label: "送付済",    variant: "info",     icon: <Send size={14} /> },
  waiting_sign: { label: "署名待ち",  variant: "warning",  icon: <Clock size={14} /> },
  completed:    { label: "締結完了",  variant: "success",  icon: <CheckCircle size={14} /> },
  voided:       { label: "無効",      variant: "danger",   icon: <XCircle size={14} /> },
};

const FLOW_STEPS: { key: ContractStatus; label: string }[] = [
  { key: "draft", label: "下書き" },
  { key: "sent", label: "送付済" },
  { key: "waiting_sign", label: "署名待ち" },
  { key: "completed", label: "締結完了" },
];

function formatDate(s: string) {
  return s.slice(0, 10).replace(/-/g, "/");
}

// ─── StatusFlow コンポーネント ────────────────────────────

function StatusFlow({ current }: { current: ContractStatus }) {
  const activeIdx = FLOW_STEPS.findIndex((s) => s.key === current);
  if (current === "voided") return <Badge variant="danger">無効</Badge>;
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

// ─── ページ ───────────────────────────────────────────────

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [dsTemplates, setDsTemplates] = useState<DocuSignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 新規作成モーダル
  const [showCreate, setShowCreate] = useState(false);
  const [memberType, setMemberType] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    // 既存メンバー用
    memberId: "",
    signerEmail: "",
    // 新規メンバー用
    newName: "",
    newEmail: "",
    newStatus: "employee",
    newPhone: "",
    newAddress: "",
    newBankName: "",
    newBankBranch: "",
    newBankAccountNumber: "",
    newBankAccountHolder: "",
    // 共通
    templateId: "",
    templateName: "",
    startDate: "",
    endDate: "",
  });
  const [creating, setCreating] = useState(false);

  // アクション中フラグ
  const [actionLoading, setActionLoading] = useState(false);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setTemplatesLoading(true);
    const [contractsRes, membersRes, templatesRes] = await Promise.all([
      fetch("/api/contracts"),
      fetch("/api/members"),
      fetch("/api/contracts/templates"),
    ]);
    if (contractsRes.ok) setContracts(await contractsRes.json());
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(Array.isArray(data) ? data : (data.members ?? []));
    }
    if (templatesRes.ok) setDsTemplates(await templatesRes.json());
    setLoading(false);
    setTemplatesLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = contracts.filter((c) => {
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchMember = memberFilter === "ALL" || c.memberId === memberFilter;
    return matchStatus && matchMember;
  });

  const selected = contracts.find((c) => c.id === selectedId);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = contracts.filter((c) => c.status === s).length;
    return acc;
  }, {});

  function resetForm() {
    setMemberType("existing");
    setForm({
      memberId: "", signerEmail: "",
      newName: "", newEmail: "", newStatus: "employee", newPhone: "",
      newAddress: "", newBankName: "", newBankBranch: "",
      newBankAccountNumber: "", newBankAccountHolder: "",
      templateId: "", templateName: "", startDate: "", endDate: "",
    });
  }

  // 新規作成
  async function handleCreate() {
    setCreating(true);
    const common = {
      templateName: form.templateName,
      docusignTemplateId: form.templateId || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };

    let res: Response;
    if (memberType === "new") {
      res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberType: "new",
          name: form.newName,
          email: form.newEmail,
          status: form.newStatus,
          phone: form.newPhone || undefined,
          address: form.newAddress || undefined,
          bankName: form.newBankName || undefined,
          bankBranch: form.newBankBranch || undefined,
          bankAccountNumber: form.newBankAccountNumber || undefined,
          bankAccountHolder: form.newBankAccountHolder || undefined,
          ...common,
        }),
      });
    } else {
      res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberType: "existing",
          memberId: form.memberId,
          signerEmail: form.signerEmail,
          ...common,
        }),
      });
    }

    if (res.ok) {
      setShowCreate(false);
      resetForm();
      showToast("契約ドラフトを作成しました");
      await loadData();
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "作成失敗"}`);
    }
    setCreating(false);
  }

  // 署名依頼送付
  async function handleSend(contract: ContractRecord) {
    setActionLoading(true);
    const res = await fetch(`/api/members/${contract.memberId}/contracts/${contract.id}/send`, {
      method: "POST",
    });
    if (res.ok) {
      showToast("署名依頼を送付しました");
      await loadData();
      setSelectedId(null);
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "送付失敗"}`);
    }
    setActionLoading(false);
  }

  // 無効化
  async function handleVoid(contract: ContractRecord) {
    if (!confirm("この契約を無効化しますか？")) return;
    setActionLoading(true);
    const res = await fetch(`/api/members/${contract.memberId}/contracts/${contract.id}/void`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "管理者により無効化" }),
    });
    if (res.ok) {
      showToast("契約を無効化しました");
      await loadData();
      setSelectedId(null);
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "無効化失敗"}`);
    }
    setActionLoading(false);
  }

  // ダウンロード
  async function handleDownload(contract: ContractRecord) {
    setActionLoading(true);
    const res = await fetch(`/api/members/${contract.memberId}/contracts/${contract.id}/download-url`);
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
    } else {
      const err = await res.json();
      showToast(`エラー: ${err.error?.message ?? "取得失敗"}`);
    }
    setActionLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm text-white shadow-lg">
          <CheckCircle size={15} className="text-green-400" />
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">契約管理</h1>
          <p className="text-sm text-slate-500">電子契約・署名ステータス管理</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <FilePlus size={16} /> 新規契約
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
      {(counts["waiting_sign"] ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock size={15} className="shrink-0" />
          署名待ちの契約が <strong>{counts["waiting_sign"]}件</strong> あります。リマインドを検討してください。
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "ALL")}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全ステータス</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{statusConfig[s].label}</option>
          ))}
        </select>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ALL">全メンバー</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
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
                  <th className="px-4 py-3 text-left font-medium">テンプレート</th>
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
                      <StatusFlow current={c.status} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{c.startDate ? formatDate(c.startDate) : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{c.endDate ? formatDate(c.endDate) : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{c.sentAt ? formatDate(c.sentAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {c.completedAt ? (
                        <span className="text-green-600 font-medium">{formatDate(c.completedAt)}</span>
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
      )}

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
              <div className="col-span-2">
                <p className="text-xs text-slate-400">テンプレート</p>
                <p className="font-medium">{selected.templateName}</p>
              </div>
              {selected.docusignTemplateId && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">DocuSign テンプレート ID</p>
                  <p className="text-xs font-mono text-slate-500 truncate">{selected.docusignTemplateId}</p>
                </div>
              )}
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
              {selected.envelopeId && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">DocuSign Envelope ID</p>
                  <p className="text-xs font-mono text-slate-500 truncate">{selected.envelopeId}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {selected.status === "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selected)}
                  disabled={actionLoading}
                >
                  <Download size={14} /> PDF ダウンロード
                </Button>
              )}
              {(selected.status === "sent" || selected.status === "waiting_sign") && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleVoid(selected)}
                  disabled={actionLoading}
                >
                  無効化
                </Button>
              )}
              {selected.status === "draft" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSend(selected)}
                  disabled={actionLoading || !selected.docusignTemplateId}
                >
                  <Send size={14} /> 署名依頼を送付
                </Button>
              )}
              {selected.status === "draft" && !selected.docusignTemplateId && (
                <p className="w-full text-right text-xs text-amber-600">
                  テンプレート未設定のため送付できません
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 新規作成モーダル */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title="新規契約作成" size="lg">
        <div className="space-y-4">
          {/* メンバー種別トグル */}
          <div className="flex rounded-lg border border-slate-200 p-1 gap-1">
            <button
              type="button"
              onClick={() => setMemberType("existing")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                memberType === "existing" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              既存メンバー
            </button>
            <button
              type="button"
              onClick={() => setMemberType("new")}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                memberType === "new" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              新規メンバー
            </button>
          </div>

          {memberType === "existing" ? (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700">メンバー <span className="text-red-500">*</span></label>
                <select
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">選択してください</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">署名者メール <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={form.signerEmail}
                  onChange={(e) => setForm({ ...form, signerEmail: e.target.value })}
                  placeholder="signer@example.com"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">氏名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.newName}
                    onChange={(e) => setForm({ ...form, newName: e.target.value })}
                    placeholder="田中 太郎"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">メールアドレス <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.newEmail}
                    onChange={(e) => setForm({ ...form, newEmail: e.target.value })}
                    placeholder="tanaka@example.com"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">ステータス <span className="text-red-500">*</span></label>
                  <select
                    value={form.newStatus}
                    onChange={(e) => setForm({ ...form, newStatus: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="executive">役員</option>
                    <option value="employee">社員</option>
                    <option value="intern_full">インターン（長期）</option>
                    <option value="intern_training">インターン（研修）</option>
                    <option value="training_member">研修生</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">電話番号</label>
                  <input
                    type="text"
                    value={form.newPhone}
                    onChange={(e) => setForm({ ...form, newPhone: e.target.value })}
                    placeholder="090-0000-0000"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">住所</label>
                <input
                  type="text"
                  value={form.newAddress}
                  onChange={(e) => setForm({ ...form, newAddress: e.target.value })}
                  placeholder="東京都渋谷区〇〇 1-2-3"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">銀行名</label>
                  <input
                    type="text"
                    value={form.newBankName}
                    onChange={(e) => setForm({ ...form, newBankName: e.target.value })}
                    placeholder="〇〇銀行"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">支店名</label>
                  <input
                    type="text"
                    value={form.newBankBranch}
                    onChange={(e) => setForm({ ...form, newBankBranch: e.target.value })}
                    placeholder="渋谷支店"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">口座番号</label>
                  <input
                    type="text"
                    value={form.newBankAccountNumber}
                    onChange={(e) => setForm({ ...form, newBankAccountNumber: e.target.value })}
                    placeholder="1234567"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">口座名義</label>
                  <input
                    type="text"
                    value={form.newBankAccountHolder}
                    onChange={(e) => setForm({ ...form, newBankAccountHolder: e.target.value })}
                    placeholder="タナカ タロウ"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* 共通: テンプレートと期間 */}
          <div className="border-t border-slate-100 pt-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                DocuSign テンプレート <span className="text-red-500">*</span>
              </label>
              <select
                value={form.templateId}
                onChange={(e) => {
                  const tpl = dsTemplates.find((t) => t.templateId === e.target.value);
                  setForm({ ...form, templateId: e.target.value, templateName: tpl?.name ?? "" });
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:text-slate-400"
                disabled={templatesLoading}
              >
                <option value="">
                  {templatesLoading ? "読み込み中..." : "テンプレートを選択"}
                </option>
                {dsTemplates.map((t) => (
                  <option key={t.templateId} value={t.templateId}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">開始日</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">終了日</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>キャンセル</Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={
                creating ||
                !form.templateId ||
                (memberType === "existing" ? (!form.memberId || !form.signerEmail) : (!form.newName || !form.newEmail))
              }
            >
              {creating ? "作成中..." : "ドラフト作成"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
