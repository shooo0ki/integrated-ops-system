"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import useSWR from "swr";
import {
  AlertTriangle, Send, RefreshCw, CheckCircle, Zap, ChevronRight, AlertCircle, FileText,
  Plus, Trash2, Download,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

type ConfirmStatus = "not_sent" | "waiting" | "confirmed" | "forced";
type InvoiceStatus = "none" | "generated" | "sent" | "approved" | "accounting_sent";

interface ClosingRecord {
  memberId: string;
  memberName: string;
  contractType: string;
  salaryType: string;
  workDays: number;
  totalHours: number;
  missingDays: number;
  estimatedAmount: number;
  confirmStatus: ConfirmStatus;
  invoiceStatus: InvoiceStatus;
  hourlyRate: number | null;
  salaryAmount: number;
}

interface InvoiceItem {
  id: string;
  name: string;
  amount: number;
  taxable: boolean;
  sortOrder: number;
}

interface Invoice {
  id: string;
  memberId: string;
  memberName: string;
  salaryType: string;
  invoiceNumber: string;
  targetMonth: string;
  workHoursTotal: number;
  unitPrice: number;
  amountExclTax: number;
  expenseAmount?: number;
  amountInclTax: number;
  status: string;
  issuedAt: string;
  items: InvoiceItem[];
}

// ─── スタイル ────────────────────────────────────────────

const confirmVariant: Record<ConfirmStatus, "default" | "warning" | "success" | "info" | "danger"> = {
  not_sent: "default", waiting: "warning", confirmed: "success", forced: "info",
};

const confirmLabel: Record<ConfirmStatus, string> = {
  not_sent: "未通知", waiting: "確認中", confirmed: "確認済", forced: "強制確定",
};

const receiptStatusConfig: Record<InvoiceStatus, { label: string; variant: "default" | "info" | "success" | "warning" }> = {
  none:            { label: "未提出",           variant: "default" },
  generated:       { label: "未提出",           variant: "default" },
  sent:            { label: "提出済み（承認待ち）", variant: "warning" },
  approved:        { label: "確認済み",         variant: "success" },
  accounting_sent: { label: "LayerX送付済み",   variant: "info" },
};

const receiptConfig: Record<string, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
  none:            { label: "未提出",           variant: "default" },
  generated:       { label: "未提出",           variant: "default" },
  sent:            { label: "提出済み（承認待ち）", variant: "warning" },
  approved:        { label: "確認済み",         variant: "success" },
  accounting_sent: { label: "LayerX送付済み",   variant: "info" },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}

function buildMonthOptions() {
  const opts: string[] = [];
  const base = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return opts;
}

// ─── ClosingTableRow（React.memo で行単位の再レンダー防止） ──

interface ClosingTableRowProps {
  rec: ClosingRecord;
  sendingSlackId: string | null;
  forcingId: string | null;
  selfReportSubmitted: boolean | undefined;
  onSendSlack: (memberId: string) => void;
  onForce: (memberId: string) => void;
}

const ClosingTableRow = memo(function ClosingTableRow({
  rec,
  sendingSlackId,
  forcingId,
  selfReportSubmitted,
  onSendSlack,
  onForce,
}: ClosingTableRowProps) {
  const isSending = sendingSlackId === rec.memberId;
  const isForcing = forcingId === rec.memberId;
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">{rec.memberName}</td>
      <td className="px-4 py-3 text-slate-500 text-xs">{rec.contractType}</td>
      <td className="px-4 py-3 text-right text-slate-600">{rec.workDays}日</td>
      <td className="px-4 py-3 text-right text-slate-600">{rec.totalHours}h</td>
      <td className={`px-4 py-3 text-right font-medium ${rec.missingDays > 0 ? "text-amber-600" : "text-slate-400"}`}>
        {rec.missingDays > 0 ? `${rec.missingDays}日` : "—"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-slate-800">
        {formatCurrency(rec.estimatedAmount)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={confirmVariant[rec.confirmStatus]}>
          {confirmLabel[rec.confirmStatus]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={receiptStatusConfig[rec.invoiceStatus].variant}>
          {receiptStatusConfig[rec.invoiceStatus].label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {selfReportSubmitted === true ? (
          <Badge variant="success">済</Badge>
        ) : (
          <Badge variant="default">未</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5 flex-wrap">
          {rec.confirmStatus === "not_sent" && (
            <Button size="sm" variant="outline" onClick={() => onSendSlack(rec.memberId)} disabled={isSending}>
              <Send size={12} /> {isSending ? "送信中..." : "Slack通知"}
            </Button>
          )}
          {rec.confirmStatus === "waiting" && (
            <>
              <Button size="sm" variant="outline" onClick={() => onSendSlack(rec.memberId)} disabled={isSending}>
                <RefreshCw size={12} /> {isSending ? "送信中..." : "再通知"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onForce(rec.memberId)} disabled={isForcing}>
                <Zap size={12} /> {isForcing ? "処理中..." : "強制確定"}
              </Button>
            </>
          )}
          {(rec.confirmStatus === "confirmed" || rec.confirmStatus === "forced") && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle size={12} /> 確認済み
            </span>
          )}
        </div>
      </td>
    </tr>
  );
});

// ─── Admin View ───────────────────────────────────────────

function AdminClosingView() {
  const [targetMonth, setTargetMonth] = useState("");
  const [aggregateWarning, setAggregateWarning] = useState(false);
  const [aggregating, setAggregating] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingSlackId, setSendingSlackId] = useState<string | null>(null);
  const [forcingId, setForcingId] = useState<string | null>(null);
  const [accountingId, setAccountingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const opts = buildMonthOptions();
    setMonthOptions(opts);
    setTargetMonth(opts[0]);
  }, []);

  const { data: records = [], isLoading: closingLoading, mutate: mutateClosing } = useSWR<ClosingRecord[]>(targetMonth ? `/api/closing?month=${targetMonth}` : null);
  const { data: invoices = [], isLoading: invoicesLoading, mutate: mutateInvoices } = useSWR<Invoice[]>(targetMonth ? `/api/invoices?month=${targetMonth}` : null);
  const { data: selfReportSummary = [] } = useSWR<{ memberId: string; submitted: boolean }[]>(targetMonth ? `/api/self-reports?month=${targetMonth}` : null);
  const loading = closingLoading || invoicesLoading;

  const selfReportMap = useMemo(
    () => new Map(selfReportSummary.map((s) => [s.memberId, s.submitted])),
    [selfReportSummary]
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  function handleAggregate() {
    if (records.some((r) => r.missingDays > 0)) {
      setAggregateWarning(true);
    } else {
      doAggregate();
    }
  }

  async function doAggregate() {
    setAggregateWarning(false);
    setAggregating(true);
    try {
      await Promise.all([mutateClosing(), mutateInvoices()]);
      showToast("集計を最新の状態に更新しました");
    } finally {
      setAggregating(false);
    }
  }

  const handleSendSlack = useCallback(async (memberId: string, memberName?: string) => {
    setSendingSlackId(memberId);
    try {
      const res = await fetch(`/api/closing/members/${memberId}/notify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: targetMonth }),
      });
      if (res.ok) {
        const name = memberName ?? records.find((r) => r.memberId === memberId)?.memberName ?? "";
        showToast(`${name} さんにSlack確認依頼を送信しました`);
        await mutateClosing(); // confirmStatus のみ変わるため invoices は不要
      }
    } finally {
      setSendingSlackId(null);
    }
  }, [targetMonth, mutateClosing, records, showToast]);

  const handleSendAll = useCallback(async () => {
    setSendingAll(true);
    try {
      const notSent = records.filter((r) => r.confirmStatus === "not_sent");
      await Promise.all(
        notSent.map((r) =>
          fetch(`/api/closing/members/${r.memberId}/notify`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ month: targetMonth }),
          })
        )
      );
      showToast("未送信メンバー全員にSlack確認依頼を送信しました");
      await mutateClosing(); // confirmStatus のみ変わるため invoices は不要
    } finally {
      setSendingAll(false);
    }
  }, [records, targetMonth, mutateClosing, showToast]);

  const handleForce = useCallback(async (memberId: string) => {
    setForcingId(memberId);
    try {
      const res = await fetch(`/api/closing/members/${memberId}/force-confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: targetMonth }),
      });
      if (res.ok) {
        showToast("強制確定しました");
        await mutateClosing(); // confirmStatus のみ変わるため invoices は不要
      }
    } finally {
      setForcingId(null);
    }
  }, [targetMonth, mutateClosing, showToast]);

  const handleAccounting = useCallback(async (invoiceId: string, memberName: string) => {
    setAccountingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/accounting`, {
        method: "PATCH",
      });
      if (res.ok) {
        showToast(`${memberName} さんの請求書を LayerX へ送付しました`);
        await Promise.all([mutateClosing(), mutateInvoices()]); // invoiceStatus が変わるため両方更新
      }
    } finally {
      setAccountingId(null);
    }
  }, [mutateClosing, mutateInvoices, showToast]);

  const {
    notSentCount, waitingCount, confirmedCount, totalEstimated, hasMissingDays, missingDaysCount,
    hourlyRecords, salaryRecords, receivedCount, hourlyLaborCost, salaryLaborCost,
    totalLaborCost, hourlyReceived, notReceivedCount, invoiceMap,
  } = useMemo(() => {
    const hourlyRecs = records.filter((r) => r.salaryType === "hourly");
    const salaryRecs = records.filter((r) => r.salaryType === "monthly");
    const hourlyLabor = hourlyRecs.reduce((s, r) => s + r.estimatedAmount, 0);
    const salaryLabor = salaryRecs.reduce((s, r) => s + r.salaryAmount, 0);
    const invReceived = invoices.filter((i) => i.status === "sent").length;
    return {
      notSentCount:   records.filter((r) => r.confirmStatus === "not_sent").length,
      waitingCount:   records.filter((r) => r.confirmStatus === "waiting").length,
      confirmedCount: records.filter((r) => r.confirmStatus === "confirmed" || r.confirmStatus === "forced").length,
      totalEstimated: records.reduce((s, r) => s + r.estimatedAmount, 0),
      hasMissingDays: records.some((r) => r.missingDays > 0),
      missingDaysCount: records.filter((r) => r.missingDays > 0).length,
      hourlyRecords:  hourlyRecs,
      salaryRecords:  salaryRecs,
      receivedCount:  hourlyRecs.filter((r) => r.invoiceStatus === "sent" || r.invoiceStatus === "approved" || r.invoiceStatus === "accounting_sent").length,
      hourlyLaborCost: hourlyLabor,
      salaryLaborCost: salaryLabor,
      totalLaborCost:  hourlyLabor + salaryLabor,
      hourlyReceived:  invReceived,
      notReceivedCount: records.length - invReceived,
      invoiceMap: new Map(invoices.map((i) => [i.memberId, i])),
    };
  }, [records, invoices]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm text-white shadow-lg">
          <CheckCircle size={15} className="text-green-400" />
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">請求管理</h1>
          <p className="text-sm text-slate-500">月末締め・請求書受領管理</p>
        </div>
        <select
          value={targetMonth}
          onChange={(e) => setTargetMonth(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </div>

      {/* Step flow */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">月末締めフロー</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { step: 1, label: "勤怠集計",        done: !loading && records.length > 0 },
            { step: 2, label: "勤怠確認（Slack）", done: records.some((r) => r.confirmStatus !== "not_sent") },
            { step: 3, label: "メンバー確認完了",  done: confirmedCount > 0 },
            { step: 4, label: "請求書受領確認",    done: hourlyRecords.length > 0 && receivedCount === hourlyRecords.length },
            { step: 5, label: "経理処理",          done: hourlyRecords.length > 0 && hourlyRecords.every((r) => r.invoiceStatus === "accounting_sent") },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center gap-1.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                item.done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
              }`}>{item.step}</span>
              <span className={item.done ? "text-green-700 font-medium" : "text-slate-500"}>{item.label}</span>
              {i < 4 && <ChevronRight size={14} className="text-slate-300 mx-0.5" />}
            </div>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">対象メンバー</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{records.length}名</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">勤怠確認待ち</p>
          <p className={`mt-1 text-2xl font-bold ${waitingCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
            {waitingCount}名
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">請求書受領</p>
          <p className={`mt-1 text-2xl font-bold ${receivedCount > 0 ? "text-green-600" : "text-slate-400"}`}>
            {receivedCount}<span className="text-base font-normal text-slate-500">/{records.length}名</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">人件費合計</p>
          <p className="mt-1 text-xl font-bold text-blue-700">{formatCurrency(totalEstimated)}</p>
        </Card>
      </div>

      {/* 未打刻アラート */}
      {!loading && hasMissingDays && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0" />
          未打刻日があるメンバーがいます。締め前に確認・修正してください。
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleAggregate} disabled={loading}>
          <RefreshCw size={15} /> データを更新
        </Button>
        {notSentCount > 0 && (
          <Button variant="primary" onClick={() => handleSendAll()} disabled={sendingAll}>
            <Send size={15} /> {sendingAll ? "送信中..." : `未通知 ${notSentCount}名 に一括Slack通知`}
          </Button>
        )}
      </div>

      {/* Members table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">メンバー</th>
                  <th className="px-4 py-3 text-left font-medium">区分</th>
                  <th className="px-4 py-3 text-right font-medium">稼働日数</th>
                  <th className="px-4 py-3 text-right font-medium">合計時間</th>
                  <th className="px-4 py-3 text-right font-medium">未打刻日</th>
                  <th className="px-4 py-3 text-right font-medium">人件費</th>
                  <th className="px-4 py-3 text-left font-medium">勤怠確認</th>
                  <th className="px-4 py-3 text-left font-medium">請求書受領</th>
                  <th className="px-4 py-3 text-left font-medium">申告</th>
                  <th className="px-4 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <ClosingTableRow
                    key={rec.memberId}
                    rec={rec}
                    sendingSlackId={sendingSlackId}
                    forcingId={forcingId}
                    selfReportSubmitted={selfReportMap.get(rec.memberId)}
                    onSendSlack={handleSendSlack}
                    onForce={handleForce}
                  />
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                      該当するデータがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Slack message preview */}
      <Card>
        <CardHeader>
          <CardTitle>Slack 確認依頼メッセージ（プレビュー）</CardTitle>
        </CardHeader>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-600 space-y-1">
          <p><span className="text-purple-600 font-bold">@[氏名]</span>さん、今月の勤怠内容をご確認ください 📋</p>
          <p className="text-slate-500">---</p>
          <p>勤務日数: <strong>X日</strong> / 合計時間: <strong>Yh</strong> / 人件費: <strong>¥Z</strong></p>
          <p className="text-slate-500">---</p>
          <p>内容に問題なければ、請求書を提出してください。</p>
        </div>
      </Card>

      {/* ─── 請求書受領状況セクション ─── */}
      <div className="border-t border-slate-200 pt-6">
        <h2 className="mb-4 text-base font-bold text-slate-800">請求書受領状況</h2>

        {notReceivedCount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={15} className="shrink-0" />
            請求書が未受領のメンバーが <strong>{notReceivedCount}名</strong> います。
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card>
            <p className="text-xs text-slate-500">総人件費（当月見込み）</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{formatCurrency(totalLaborCost)}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500">受領済み</p>
            <p className={`mt-1 text-2xl font-bold ${hourlyReceived > 0 ? "text-green-600" : "text-slate-400"}`}>
              {hourlyReceived}
              <span className="ml-1 text-sm font-normal text-slate-500">/ {records.length}名</span>
            </p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500">未受領</p>
            <p className={`mt-1 text-2xl font-bold ${notReceivedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {notReceivedCount}
              <span className="ml-1 text-sm font-normal text-slate-500">名</span>
            </p>
          </Card>
        </div>

        {!loading && (
          <>
            {/* 時給制テーブル */}
            <Card noPadding>
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-slate-600">時給制（インターン・業務委託）</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-slate-100">
                    <tr className="text-xs text-slate-500">
                      <th className="px-4 py-3 text-left font-medium">メンバー</th>
                      <th className="px-4 py-3 text-right font-medium">稼働時間</th>
                      <th className="px-4 py-3 text-right font-medium">時給</th>
                      <th className="px-4 py-3 text-right font-medium">人件費</th>
                      <th className="px-4 py-3 text-left font-medium">請求書受領</th>
                      <th className="px-4 py-3 text-left font-medium">請求書番号</th>
                      <th className="px-4 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyRecords.map((rec) => {
                      const inv = invoiceMap.get(rec.memberId);
                      const invStatus = inv?.status ?? "none";
                      const displayStatus = invStatus === "confirmed" ? "accounting_sent" : invStatus === "sent" ? "sent" : inv ? "generated" : "none";
                      const cfg = receiptConfig[displayStatus] ?? receiptConfig["none"];
                      return (
                        <tr key={rec.memberId} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{rec.memberName}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{rec.totalHours}h</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">
                            {formatCurrency(rec.salaryAmount)}/h
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {inv ? formatCurrency(inv.amountExclTax) : formatCurrency(rec.estimatedAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {inv?.invoiceNumber ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {inv && (
                                <Button size="sm" variant="outline" onClick={() => setDetailInvoice(inv)}>
                                  <FileText size={12} /> 明細
                                </Button>
                              )}
                              {inv && invStatus === "sent" && (
                                <Button size="sm" variant="primary" onClick={() => handleAccounting(inv.id, rec.memberName)} disabled={accountingId === inv.id}>
                                  <Send size={12} /> {accountingId === inv.id ? "送付中..." : "LayerXへ送付"}
                                </Button>
                              )}
                              {invStatus === "confirmed" && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle size={12} /> LayerX送付済み
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {hourlyRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-sm text-slate-400">データがありません</td>
                      </tr>
                    )}
                  </tbody>
                  {hourlyRecords.length > 0 && (
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-slate-600">小計</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-700">
                          {formatCurrency(hourlyLaborCost)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* 給与制テーブル */}
            {salaryRecords.length > 0 && (
              <Card noPadding className="mt-4">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-xs font-semibold text-slate-600">月給制（正社員・役員）</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100">
                      <tr className="text-xs text-slate-500">
                        <th className="px-4 py-3 text-left font-medium">メンバー</th>
                        <th className="px-4 py-3 text-right font-medium">月額</th>
                        <th className="px-4 py-3 text-left font-medium">請求書受領</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryRecords.map((m) => (
                        <tr key={m.memberId} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{m.memberName}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(m.salaryAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="default">未受領</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td className="px-4 py-2 text-xs font-semibold text-slate-600">小計</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-700">
                          {formatCurrency(salaryLaborCost)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            )}

          </>
        )}
      </div>

      {/* 集計確認モーダル */}
      <Modal
        isOpen={aggregateWarning}
        onClose={() => setAggregateWarning(false)}
        title="集計実行の確認"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              {missingDaysCount}名に未打刻日があります。このまま集計を更新しますか？
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAggregateWarning(false)}>キャンセル</Button>
            <Button variant="danger" onClick={doAggregate} disabled={aggregating}>{aggregating ? "更新中..." : "このまま更新する"}</Button>
          </div>
        </div>
      </Modal>

      {/* 請求書明細モーダル */}
      {detailInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setDetailInvoice(null)}
          title={`請求書明細 — ${detailInvoice.memberName}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>請求書番号: <strong className="text-slate-700">{detailInvoice.invoiceNumber}</strong></span>
              <span>発行日: {detailInvoice.issuedAt}</span>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="pb-2 text-left font-medium">項目名</th>
                  <th className="pb-2 text-center font-medium w-20">区分</th>
                  <th className="pb-2 text-right font-medium w-32">金額</th>
                </tr>
              </thead>
              <tbody>
                {detailInvoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">{item.name}</td>
                    <td className="py-2 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        item.taxable ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {item.taxable ? "課税" : "非課税"}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-700">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="pt-3 text-xs text-slate-500">税抜小計</td>
                  <td className="pt-3 text-right text-sm text-slate-600">{formatCurrency(detailInvoice.amountExclTax)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 text-xs text-slate-500">消費税（10%）</td>
                  <td className="py-1 text-right text-sm text-slate-500">
                    {formatCurrency(Math.round(detailInvoice.amountExclTax * 0.1))}
                  </td>
                </tr>
                {(detailInvoice.expenseAmount ?? 0) > 0 && (
                  <tr>
                    <td colSpan={2} className="py-1 text-xs text-slate-500">経費（非課税）</td>
                    <td className="py-1 text-right text-sm text-emerald-600">{formatCurrency(detailInvoice.expenseAmount ?? 0)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="pt-2 font-bold text-slate-800">合計（税込）</td>
                  <td className="pt-2 text-right font-bold text-blue-700 text-base">{formatCurrency(detailInvoice.amountInclTax)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailInvoice(null)}>閉じる</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Member View ──────────────────────────────────────────

interface LineItem {
  id: string;
  name: string;
  amount: number;
}

interface ExpenseItem {
  id: string;
  projectId: string;
  description: string;
  amount: number;
}

interface MyProject {
  projectId: string;
  projectName: string;
}

interface SelfReportRow {
  key: string;
  projectId: string | null;
  customLabel: string | null;
  displayName: string;
  reportedPercent: number;
}

interface SelfReportItem {
  id: string;
  projectId: string | null;
  projectName: string | null;
  customLabel: string | null;
  reportedPercent: number;
  reportedHours: number | null;
  submittedAt: string | null;
}

function SelfReportCard({
  month,
  myProjects,
}: {
  month: string;
  myProjects: MyProject[];
}) {
  const { data: selfReports, mutate: mutateSR } = useSWR<SelfReportItem[]>(
    month ? `/api/self-reports?month=${month}` : null
  );

  const [rows, setRows] = useState<SelfReportRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitted = selfReports && selfReports.length > 0 && selfReports.every((r) => r.submittedAt);

  useEffect(() => {
    if (!selfReports) return;
    if (selfReports.length > 0) {
      setRows(
        selfReports.map((r) => ({
          key: r.id,
          projectId: r.projectId,
          customLabel: r.customLabel,
          displayName: r.projectName ?? r.customLabel ?? "—",
          reportedPercent: r.reportedPercent,
        }))
      );
      setEditing(false);
    } else {
      setRows(
        myProjects.map((p) => ({
          key: p.projectId,
          projectId: p.projectId,
          customLabel: null,
          displayName: p.projectName,
          reportedPercent: 0,
        }))
      );
      setEditing(true);
    }
  }, [selfReports, myProjects]);

  const totalPercent = rows.reduce((s, r) => s + r.reportedPercent, 0);
  const isValid = totalPercent === 100;

  function updatePercent(key: string, value: number) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, reportedPercent: value } : r));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addProject(projectId: string) {
    const pj = myProjects.find((p) => p.projectId === projectId);
    if (!pj) return;
    setRows((prev) => [
      ...prev,
      { key: projectId, projectId, customLabel: null, displayName: pj.projectName, reportedPercent: 0 },
    ]);
    setShowProjectPicker(false);
  }

  function addCustomLabel() {
    const label = customInput.trim();
    if (!label) return;
    if (rows.some((r) => r.customLabel === label)) {
      setError("同名のカスタム項目が既にあります");
      return;
    }
    setRows((prev) => [
      ...prev,
      { key: `custom-${label}`, projectId: null, customLabel: label, displayName: label, reportedPercent: 0 },
    ]);
    setCustomInput("");
    setShowCustom(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/self-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMonth: month,
        allocations: rows.map((r) => ({
          projectId: r.projectId || undefined,
          customLabel: r.customLabel || undefined,
          reportedPercent: r.reportedPercent,
        })),
      }),
    });
    if (res.ok) {
      await mutateSR();
      setEditing(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message ?? "申告に失敗しました");
    }
    setSubmitting(false);
  }

  const availableProjects = myProjects.filter(
    (p) => !rows.some((r) => r.projectId === p.projectId)
  );

  if (!month) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>月次工数自己申告</CardTitle>
          {submitted && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>修正する</Button>
          )}
        </div>
      </CardHeader>

      {submitted && !editing ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
            <CheckCircle size={15} className="text-green-600" />
            <span className="text-sm text-green-700 font-medium">申告済み</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs text-slate-500">
                <th className="py-2 text-left font-medium">項目</th>
                <th className="py-2 text-right font-medium">配分</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{r.displayName}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{r.reportedPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 text-right">合計: {totalPercent}%</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            各プロジェクトの工数配分を%で入力してください（合計100%）
          </p>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs text-slate-500">
                <th className="py-2 text-left font-medium">項目</th>
                <th className="py-2 text-right font-medium w-24">配分(%)</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{r.displayName}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={r.reportedPercent}
                      onChange={(e) => updatePercent(r.key, Number(e.target.value) || 0)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <button
                      onClick={() => removeRow(r.key)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center gap-2">
            {availableProjects.length > 0 && (
              showProjectPicker ? (
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) addProject(e.target.value); }}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                  onBlur={() => setShowProjectPicker(false)}
                >
                  <option value="">プロジェクトを選択...</option>
                  {availableProjects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => setShowProjectPicker(true)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus size={14} /> プロジェクト追加
                </button>
              )
            )}

            {showCustom ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomLabel(); }}
                  placeholder="例: 社内業務"
                  className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                <Button size="sm" variant="outline" onClick={addCustomLabel}>追加</Button>
                <button
                  onClick={() => { setShowCustom(false); setCustomInput(""); }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustom(true)}
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800"
              >
                <Plus size={14} /> カスタム追加
              </button>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-slate-600">
              合計: <span className={`font-bold ${isValid ? "text-green-600" : "text-red-600"}`}>{totalPercent}%</span>
              {!isValid && <span className="ml-2 text-xs text-red-500">（100%にしてください）</span>}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !isValid || rows.length === 0}
            >
              {submitting ? "送信中..." : "申告する"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function MemberBillingView({ memberId }: { memberId: string }) {
  const [month, setMonth] = useState("");
  const [closing, setClosing] = useState<ClosingRecord | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 経費入力
  const [hasExpense, setHasExpense] = useState<"none" | "yes">("none");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  // 交通費入力
  const [hasTransport, setHasTransport] = useState<"none" | "yes">("none");
  const [transports, setTransports] = useState<ExpenseItem[]>([]);

  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  useEffect(() => {
    const opts = buildMonthOptions();
    setMonthOptions(opts);
    setMonth(opts[0]);
  }, []);

  const { data: closingData, isLoading: closingLoading } = useSWR<ClosingRecord[]>(month ? `/api/closing?month=${month}` : null);
  const { data: invoiceData, isLoading: invoiceLoading, mutate: mutateInvoice } = useSWR<Invoice | null>(month ? `/api/invoices?month=${month}&mine=1` : null);
  const { data: mypageData } = useSWR<{ projects?: MyProject[] }>("/api/mypage");
  const loading = closingLoading || invoiceLoading;

  const myProjects: MyProject[] = mypageData?.projects ?? [];

  // Initialize derived state when SWR data loads
  useEffect(() => {
    if (closingLoading || invoiceLoading) return;

    const closingRecord = Array.isArray(closingData)
      ? closingData.find((r) => r.memberId === memberId) ?? null
      : null;
    setClosing(closingRecord);

    setSubmitted(false);
    setInvoice(null);
    setHasExpense("none");
    setExpenses([]);
    setHasTransport("none");
    setTransports([]);

    const inv = invoiceData ?? null;
    if (inv) {
      setInvoice(inv);
      setSubmitted(true);
      // 既存 items を課税/非課税に分けて復元
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        const taxableItems = inv.items.filter((it: { taxable: boolean }) => it.taxable !== false);
        const nonTaxableItems = inv.items.filter((it: { taxable: boolean; linkedProjectId?: string }) => it.taxable === false);
        setItems(taxableItems.map((it: { id: string; name: string; amount: number }) => ({
          id: it.id,
          name: it.name,
          amount: it.amount,
        })));
        if (nonTaxableItems.length > 0) {
          setHasExpense("yes");
          setExpenses(nonTaxableItems.map((it: { id: string; name: string; amount: number; linkedProjectId?: string }) => ({
            id: it.id,
            projectId: it.linkedProjectId ?? "",
            description: it.name,
            amount: it.amount,
          })));
        }
      }
    } else if (closingRecord) {
      setItems([{
        id: "base",
        name: `稼働（${closingRecord.totalHours}h × ¥${closingRecord.salaryAmount}/h）`,
        amount: closingRecord.estimatedAmount,
      }]);
    }
  }, [closingData, invoiceData, closingLoading, invoiceLoading, memberId]);

  function addItem() {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: 0 }]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateItem(id: string, field: "name" | "amount", value: string | number) {
    setItems((prev) =>
      prev.map((it) => it.id === id ? { ...it, [field]: value } : it)
    );
  }

  function addExpense() {
    setExpenses((prev) => [...prev, { id: crypto.randomUUID(), projectId: "", description: "", amount: 0 }]);
  }
  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }
  function updateExpense(id: string, field: keyof ExpenseItem, value: string | number) {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  function addTransport() {
    setTransports((prev) => [...prev, { id: crypto.randomUUID(), projectId: "", description: "", amount: 0 }]);
  }
  function removeTransport(id: string) {
    setTransports((prev) => prev.filter((e) => e.id !== id));
  }
  function updateTransport(id: string, field: keyof ExpenseItem, value: string | number) {
    setTransports((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  async function handleGenerate() {
    if (items.length === 0) return;
    setGenerating(true);

    // 稼働明細（課税）+ 交通費・経費（非課税）を統合
    const nonTaxableItems = [
      ...(hasTransport === "yes" ? transports
        .filter((e) => e.description && e.amount > 0)
        .map((e) => ({ name: e.description, amount: Number(e.amount) || 0, taxable: false, linkedProjectId: e.projectId || undefined }))
        : []),
      ...(hasExpense === "yes" ? expenses
        .filter((e) => e.description && e.amount > 0)
        .map((e) => ({ name: e.description, amount: Number(e.amount) || 0, taxable: false, linkedProjectId: e.projectId || undefined }))
        : []),
    ];
    const allItems = [
      ...items.map((it) => ({ name: it.name, amount: Number(it.amount) || 0, taxable: true })),
      ...nonTaxableItems,
    ];

    const res = await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMonth: month, items: allItems }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filename = cd.match(/filename="(.+?)"/)?.[1] ?? `invoice-${month}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setSubmitted(true);
      await mutateInvoice();
    }
    setGenerating(false);
  }

  // リアルタイム計算
  const { subtotal, taxAmount, transportTotal, expenseTotal, total } = useMemo(() => {
    const subtotalValue = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const taxAmountValue = Math.round(subtotalValue * 0.1);
    const transportTotalValue = hasTransport === "yes"
      ? transports.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      : 0;
    const expenseTotalValue = hasExpense === "yes"
      ? expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      : 0;
    return {
      subtotal: subtotalValue,
      taxAmount: taxAmountValue,
      transportTotal: transportTotalValue,
      expenseTotal: expenseTotalValue,
      total: subtotalValue + taxAmountValue + transportTotalValue + expenseTotalValue,
    };
  }, [items, hasTransport, transports, hasExpense, expenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">請求管理</h1>
          <p className="text-sm text-slate-500">{month.replace("-", "年")}月</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </div>

      {/* 月次工数自己申告 */}
      <SelfReportCard month={month} myProjects={myProjects} />

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 稼働サマリー */}
          {closing && (
            <Card>
              <CardHeader>
                <CardTitle>今月の稼働実績</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">稼働日数</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{closing.workDays}日</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">合計時間</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{closing.totalHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">時給</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">
                    {formatCurrency(closing.salaryAmount)}/h
                  </p>
                </div>
              </div>
            </Card>
          )}
          {!closing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              この月の勤怠データがありません
            </div>
          )}

          {/* 完了バナー */}
          {submitted && invoice && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle size={16} className="shrink-0 text-green-600" />
              <span>請求書を生成済みです（{invoice.invoiceNumber}）</span>
              <button
                className="ml-auto text-xs text-slate-500 underline hover:text-slate-700"
                onClick={() => setSubmitted(false)}
              >
                再生成する
              </button>
            </div>
          )}

          {/* 明細エディタ */}
          <Card>
            <CardHeader>
              <CardTitle>
                <FileText size={16} className="inline mr-1" />
                請求書明細
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {/* 明細テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-200">
                      <th className="py-2 text-left font-medium">項目名</th>
                      <th className="py-2 text-right font-medium w-36">金額（税抜）</th>
                      <th className="py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          {idx === 0 ? (
                            <span className="block px-2 py-1.5 text-sm text-slate-700">{item.name}</span>
                          ) : (
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, "name", e.target.value)}
                              placeholder="項目名"
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {idx === 0 ? (
                            <span className="block px-2 py-1.5 text-right text-sm font-medium text-slate-700">
                              {formatCurrency(item.amount)}
                            </span>
                          ) : (
                            <input
                              type="number"
                              value={item.amount === 0 ? "" : item.amount}
                              onChange={(e) => updateItem(item.id, "amount", Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                            />
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {idx > 0 ? (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                              title="削除"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span className="inline-block w-3.5" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Plus size={14} /> 行を追加
              </button>

              {/* 合計サマリー */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>稼働小計（税抜）</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>消費税（10%）</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                {transportTotal > 0 && (
                  <div className="flex justify-between text-sky-700">
                    <span>交通費合計（非課税）</span>
                    <span>{formatCurrency(transportTotal)}</span>
                  </div>
                )}
                {expenseTotal > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>経費合計（非課税）</span>
                    <span>{formatCurrency(expenseTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-300 pt-1.5 mt-1.5">
                  <span>合計</span>
                  <span className="text-blue-700 text-base">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* 交通費セクション */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">交通費</label>
                  <select
                    value={hasTransport}
                    onChange={(e) => {
                      const v = e.target.value as "none" | "yes";
                      setHasTransport(v);
                      if (v === "yes" && transports.length === 0) addTransport();
                      if (v === "none") setTransports([]);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="none">なし</option>
                    <option value="yes">あり</option>
                  </select>
                </div>
                {hasTransport === "yes" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      交通費は消費税がかかりません。プロジェクトを選択するとプロジェクト別PLに反映されます。
                    </p>
                    {transports.map((tr) => (
                      <div key={tr.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
                        <div className="space-y-1">
                          <select
                            value={tr.projectId}
                            onChange={(e) => updateTransport(tr.id, "projectId", e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">プロジェクト外（SALT2計上）</option>
                            {myProjects.map((p) => (
                              <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={tr.description}
                            onChange={(e) => updateTransport(tr.id, "description", e.target.value)}
                            placeholder="説明（例: 渋谷→新宿 往復）"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            value={tr.amount === 0 ? "" : tr.amount}
                            onChange={(e) => updateTransport(tr.id, "amount", Number(e.target.value) || 0)}
                            placeholder="金額"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <span className="pt-2 text-sm text-slate-500">円</span>
                        <button
                          onClick={() => removeTransport(tr.id)}
                          className="pt-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addTransport}
                      className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-800 transition-colors"
                    >
                      <Plus size={14} /> 交通費を追加
                    </button>
                  </div>
                )}
              </div>

              {/* 経費入力セクション */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">経費</label>
                  <select
                    value={hasExpense}
                    onChange={(e) => {
                      const v = e.target.value as "none" | "yes";
                      setHasExpense(v);
                      if (v === "yes" && expenses.length === 0) addExpense();
                      if (v === "none") setExpenses([]);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="none">なし</option>
                    <option value="yes">あり</option>
                  </select>
                </div>
                {hasExpense === "yes" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      経費は消費税がかかりません。プロジェクトを選択するとプロジェクト別PLに反映されます。未選択の場合はSALT2の業務経費として計上されます。
                    </p>
                    {expenses.map((exp) => (
                      <div key={exp.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
                        <div className="space-y-1">
                          <select
                            value={exp.projectId}
                            onChange={(e) => updateExpense(exp.id, "projectId", e.target.value)}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">プロジェクト外（SALT2計上）</option>
                            {myProjects.map((p) => (
                              <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={exp.description}
                            onChange={(e) => updateExpense(exp.id, "description", e.target.value)}
                            placeholder="説明（例: 参考書代）"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            value={exp.amount === 0 ? "" : exp.amount}
                            onChange={(e) => updateExpense(exp.id, "amount", Number(e.target.value) || 0)}
                            placeholder="金額"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <span className="pt-2 text-sm text-slate-500">円</span>
                        <button
                          onClick={() => removeExpense(exp.id)}
                          className="pt-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addExpense}
                      className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 transition-colors"
                    >
                      <Plus size={14} /> 経費を追加
                    </button>
                  </div>
                )}
              </div>

              {/* 生成ボタン */}
              <Button
                variant="primary"
                className="w-full"
                onClick={handleGenerate}
                disabled={generating || items.length === 0 || items.some((it) => !it.name)}
              >
                <Download size={16} />
                {generating ? "送付中..." : "生成して管理者へ送付する"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function ClosingPage() {
  const { role, memberId, isLoading } = useAuth();

  // auth 解決前に member/admin 分岐を行うと、両ビューの API が連続発火し得るため待機する
  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
    );
  }

  if (role === "admin" || role === "manager") return <AdminClosingView />;
  return <MemberBillingView memberId={memberId ?? ""} />;
}
