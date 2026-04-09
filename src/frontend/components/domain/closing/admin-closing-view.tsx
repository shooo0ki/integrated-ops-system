"use client";
import { Select } from "@/frontend/components/common/input";

import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import {
  AlertTriangle, Send, RefreshCw, CheckCircle, Zap, FileText,
} from "lucide-react";
import { Card } from "@/frontend/components/common/card";
import { Badge } from "@/frontend/components/common/badge";
import { Button } from "@/frontend/components/common/button";
import { Modal } from "@/frontend/components/common/modal";
import { Toast } from "@/frontend/components/common/toast";
import { useToast } from "@/frontend/hooks/use-toast";

import type {
  ConfirmStatus, ClosingRecord, Invoice,
} from "@/shared/types/closing";
import {
  confirmVariant, confirmLabel, receiptConfig,
  formatCurrency, buildMonthOptions,
} from "@/frontend/constants/closing";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";

export function AdminClosingView() {
  const [targetMonth, setTargetMonth] = useState("");
  const [aggregateWarning, setAggregateWarning] = useState(false);
  const [aggregating, setAggregating] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingSlackId, setSendingSlackId] = useState<string | null>(null);
  const [forcingId, setForcingId] = useState<string | null>(null);
  const [accountingId, setAccountingId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    const opts = buildMonthOptions();
    setMonthOptions(opts);
    setTargetMonth(opts[0]);
  }, []);

  const { data: records = [], isLoading: closingLoading, mutate: mutateClosing } = useSWR<ClosingRecord[]>(targetMonth ? `/api/closing?month=${targetMonth}` : null);
  const { data: invoices = [], isLoading: invoicesLoading, mutate: mutateInvoices } = useSWR<Invoice[]>(targetMonth ? `/api/invoices?month=${targetMonth}` : null);
  const loading = closingLoading || invoicesLoading;

  const showToast = toast.show;

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
        await mutateClosing();
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
      await mutateClosing();
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
        await mutateClosing();
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
        await Promise.all([mutateClosing(), mutateInvoices()]);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error?.message ?? `送付に失敗しました（${res.status}）`);
      }
    } catch {
      showToast("ネットワークエラーが発生しました");
    } finally {
      setAccountingId(null);
    }
  }, [mutateClosing, mutateInvoices, showToast]);

  const {
    notSentCount, hasMissingDays, missingDaysCount,
    hourlyRecords, salaryRecords, receivedCount, hourlyLaborCost, salaryLaborCost,
    totalLaborCost, invoiceMap,
  } = useMemo(() => {
    const hourlyRecs = records.filter((r) => r.salaryType === "hourly");
    const salaryRecs = records.filter((r) => r.salaryType === "monthly");
    const hourlyLabor = hourlyRecs.reduce((s, r) => s + r.estimatedAmount, 0);
    const salaryLabor = salaryRecs.reduce((s, r) => s + r.salaryAmount, 0);
    const received = hourlyRecs.filter((r) => r.invoiceStatus === "sent" || r.invoiceStatus === "approved" || r.invoiceStatus === "accounting_sent").length;
    return {
      notSentCount:     records.filter((r) => r.confirmStatus === "not_sent").length,
      hasMissingDays:   records.some((r) => r.missingDays > 0),
      missingDaysCount: records.filter((r) => r.missingDays > 0).length,
      hourlyRecords:    hourlyRecs,
      salaryRecords:    salaryRecs,
      receivedCount:    received,
      hourlyLaborCost:  hourlyLabor,
      salaryLaborCost:  salaryLabor,
      totalLaborCost:   hourlyLabor + salaryLabor,
      invoiceMap:       new Map(invoices.map((i) => [i.memberId, i])),
    };
  }, [records, invoices]);

  return (
    <div className="space-y-6">
      <Toast message={toast.message} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">請求管理</h1>
          <p className="text-sm text-slate-500">月末締め・請求書受領管理</p>
        </div>
        <Select
          value={targetMonth}
          onChange={(e) => setTargetMonth(e.target.value)}
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
              <div className="mt-2 h-7 w-24 rounded bg-slate-100 animate-pulse" />
            </Card>
          ))
        ) : (
          <>
            <Card>
              <p className="text-xs text-slate-500">人件費合計</p>
              <p className="mt-1 text-lg font-bold text-blue-700 truncate sm:text-xl">{formatCurrency(totalLaborCost)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">請求書受領</p>
              <p className={`mt-1 text-2xl font-bold ${receivedCount > 0 ? "text-green-600" : "text-slate-400"}`}>
                {receivedCount}<span className="text-base font-normal text-slate-500">/{records.length}名</span>
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">Slack通知</p>
              <p className={`mt-1 text-lg font-bold truncate sm:text-2xl ${notSentCount > 0 ? "text-amber-600" : "text-green-600"}`}>
                {notSentCount > 0 ? `未通知${notSentCount}名` : "全員通知済"}
              </p>
            </Card>
          </>
        )}
      </div>

      {/* 未打刻アラート */}
      {!loading && hasMissingDays && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0" />
          未打刻日があるメンバーが {missingDaysCount}名 います。締め前に確認・修正してください。
        </div>
      )}

      {/* Action bar */}
      {!loading && (
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
      )}

      {/* 請求書受領状況テーブル */}
      {loading ? (
        <InlineSkeleton />
      ) : (
        <>
          {/* 時給制テーブル */}
          <Card noPadding>
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-600">時給制（インターン・業務委託）</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-100">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">メンバー</th>
                    <th className="px-4 py-3 text-right font-medium">稼働時間</th>
                    <th className="px-4 py-3 text-right font-medium">時給</th>
                    <th className="px-4 py-3 text-right font-medium">人件費</th>
                    <th className="px-4 py-3 text-left font-medium">請求書</th>
                    <th className="px-4 py-3 text-left font-medium">勤怠確認</th>
                    <th className="px-4 py-3 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyRecords.map((rec) => {
                    const inv = invoiceMap.get(rec.memberId);
                    const invStatus = inv?.status ?? "none";
                    const displayStatus = invStatus === "confirmed" ? "accounting_sent" : invStatus === "sent" ? "sent" : inv ? "generated" : "none";
                    const cfg = receiptConfig[displayStatus] ?? receiptConfig["none"];
                    const isSending = sendingSlackId === rec.memberId;
                    const isForcing = forcingId === rec.memberId;
                    return (
                      <tr key={rec.memberId} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800">{rec.memberName}</span>
                          {rec.missingDays > 0 && (
                            <span className="ml-1.5 text-xs text-amber-600">未打刻{rec.missingDays}日</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{rec.totalHours}h</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">
                          {formatCurrency(rec.salaryAmount)}/h
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {inv ? formatCurrency(inv.amountExclTax) : formatCurrency(rec.estimatedAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            {inv?.invoiceNumber && (
                              <span className="text-[10px] text-slate-400">{inv.invoiceNumber}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={confirmVariant[rec.confirmStatus]}>
                            {confirmLabel[rec.confirmStatus]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rec.confirmStatus === "not_sent" && (
                              <Button size="sm" variant="outline" onClick={() => handleSendSlack(rec.memberId, rec.memberName)} disabled={isSending}>
                                <Send size={12} /> {isSending ? "送信中" : "通知"}
                              </Button>
                            )}
                            {rec.confirmStatus === "waiting" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleSendSlack(rec.memberId, rec.memberName)} disabled={isSending}>
                                  <RefreshCw size={12} /> {isSending ? "送信中" : "再通知"}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => handleForce(rec.memberId)} disabled={isForcing}>
                                  <Zap size={12} /> {isForcing ? "処理中" : "強制確定"}
                                </Button>
                              </>
                            )}
                            {inv && (
                              <Button size="sm" variant="outline" onClick={() => setDetailInvoice(inv)}>
                                <FileText size={12} /> 明細
                              </Button>
                            )}
                            {inv && invStatus === "sent" && (
                              <Button size="sm" variant="primary" onClick={() => handleAccounting(inv.id, rec.memberName)} disabled={accountingId === inv.id}>
                                <Send size={12} /> {accountingId === inv.id ? "送付中" : "LayerX"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {hourlyRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-slate-400">データがありません</td>
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
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {/* 月給制テーブル */}
          {salaryRecords.length > 0 && (
            <Card noPadding>
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-slate-600">月給制（正社員・役員）</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="border-b border-slate-100">
                    <tr className="text-xs text-slate-500">
                      <th className="px-4 py-3 text-left font-medium">メンバー</th>
                      <th className="px-4 py-3 text-right font-medium">月額</th>
                      <th className="px-4 py-3 text-left font-medium">勤怠確認</th>
                      <th className="px-4 py-3 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryRecords.map((rec) => {
                      const isSending = sendingSlackId === rec.memberId;
                      const isForcing = forcingId === rec.memberId;
                      return (
                        <tr key={rec.memberId} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">{rec.memberName}</span>
                            {rec.missingDays > 0 && (
                              <span className="ml-1.5 text-xs text-amber-600">未打刻{rec.missingDays}日</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(rec.salaryAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={confirmVariant[rec.confirmStatus]}>
                              {confirmLabel[rec.confirmStatus]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {rec.confirmStatus === "not_sent" && (
                                <Button size="sm" variant="outline" onClick={() => handleSendSlack(rec.memberId, rec.memberName)} disabled={isSending}>
                                  <Send size={12} /> {isSending ? "送信中" : "通知"}
                                </Button>
                              )}
                              {rec.confirmStatus === "waiting" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleSendSlack(rec.memberId, rec.memberName)} disabled={isSending}>
                                    <RefreshCw size={12} /> {isSending ? "送信中" : "再通知"}
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => handleForce(rec.memberId)} disabled={isForcing}>
                                    <Zap size={12} /> {isForcing ? "処理中" : "強制確定"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td className="px-4 py-2 text-xs font-semibold text-slate-600">小計</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-700">
                        {formatCurrency(salaryLaborCost)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

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
