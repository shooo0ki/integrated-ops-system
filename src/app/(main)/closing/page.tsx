"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, Send, RefreshCw, CheckCircle, Zap, ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
}

// ─── スタイル ────────────────────────────────────────────

const confirmVariant: Record<ConfirmStatus, "default" | "warning" | "success" | "info" | "danger"> = {
  not_sent: "default", waiting: "warning", confirmed: "success", forced: "info",
};

const confirmLabel: Record<ConfirmStatus, string> = {
  not_sent: "未通知", waiting: "確認中", confirmed: "確認済", forced: "強制確定",
};

const receiptStatusConfig: Record<InvoiceStatus, { label: string; variant: "default" | "info" | "success" | "warning" }> = {
  none:            { label: "未受領",       variant: "default" },
  generated:       { label: "未受領",       variant: "default" },
  sent:            { label: "受領済み",     variant: "warning" },
  approved:        { label: "確認済み",     variant: "success" },
  accounting_sent: { label: "経理処理済み", variant: "info" },
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}

// 月オプション生成
function buildMonthOptions() {
  const opts: string[] = [];
  const base = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    opts.push(d.toISOString().slice(0, 7));
  }
  return opts;
}

// ─── ページ ───────────────────────────────────────────────

export default function ClosingPage() {
  const [targetMonth, setTargetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<ClosingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregateWarning, setAggregateWarning] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const monthOptions = buildMonthOptions();

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/closing?month=${targetMonth}`);
    if (res.ok) {
      setRecords(await res.json());
    }
    setLoading(false);
  }, [targetMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleAggregate() {
    if (records.some((r) => r.missingDays > 0)) {
      setAggregateWarning(true);
    } else {
      doAggregate();
    }
  }

  async function doAggregate() {
    setAggregateWarning(false);
    await loadData();
    showToast("集計を最新の状態に更新しました");
  }

  async function handleSendSlack(memberId: string) {
    const res = await fetch(`/api/closing/members/${memberId}/notify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: targetMonth }),
    });
    if (res.ok) {
      const memberName = records.find((r) => r.memberId === memberId)?.memberName ?? "";
      showToast(`${memberName} さんにSlack確認依頼を送信しました`);
      await loadData();
    }
  }

  async function handleSendAll() {
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
    await loadData();
  }

  async function handleForce(memberId: string) {
    const res = await fetch(`/api/closing/members/${memberId}/force-confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: targetMonth }),
    });
    if (res.ok) {
      showToast("強制確定しました");
      await loadData();
    }
  }

  const notSentCount = records.filter((r) => r.confirmStatus === "not_sent").length;
  const waitingCount = records.filter((r) => r.confirmStatus === "waiting").length;
  const confirmedCount = records.filter((r) => r.confirmStatus === "confirmed" || r.confirmStatus === "forced").length;
  const receivedCount = records.filter((r) => r.invoiceStatus === "sent" || r.invoiceStatus === "approved" || r.invoiceStatus === "accounting_sent").length;
  const totalEstimated = records.reduce((s, r) => s + r.estimatedAmount, 0);
  const hasMissingDays = records.some((r) => r.missingDays > 0);

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
          <h1 className="text-xl font-bold text-slate-800">月末締め管理</h1>
          <p className="text-sm text-slate-500">時給制メンバー（インターン・業務委託）</p>
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
            { step: 4, label: "請求書受領確認",    done: receivedCount === records.length && records.length > 0 },
            { step: 5, label: "経理処理",          done: records.every((r) => r.invoiceStatus === "accounting_sent") && records.length > 0 },
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
          <RefreshCw size={15} /> 勤怠集計を更新
        </Button>
        {notSentCount > 0 && (
          <Button variant="primary" onClick={handleSendAll}>
            <Send size={15} /> 未通知 {notSentCount}名 に一括Slack通知
          </Button>
        )}
      </div>

      {/* Members table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                  <th className="px-4 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.memberId} className="border-b border-slate-50 hover:bg-slate-50">
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
                      <div className="flex gap-1.5 flex-wrap">
                        {rec.confirmStatus === "not_sent" && (
                          <Button size="sm" variant="outline" onClick={() => handleSendSlack(rec.memberId)}>
                            <Send size={12} /> Slack通知
                          </Button>
                        )}
                        {rec.confirmStatus === "waiting" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleSendSlack(rec.memberId)}>
                              <RefreshCw size={12} /> 再通知
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleForce(rec.memberId)}>
                              <Zap size={12} /> 強制確定
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
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
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
              {records.filter((r) => r.missingDays > 0).length}名に未打刻日があります。このまま集計を更新しますか？
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAggregateWarning(false)}>キャンセル</Button>
            <Button variant="danger" onClick={doAggregate}>このまま更新する</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
