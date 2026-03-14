"use client";
import { downloadBlob } from "@/shared/utils";
import { Select } from "@/frontend/components/common/input";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { CheckCircle, FileText, Plus, Trash2, Download } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Button } from "@/frontend/components/common/button";

import type { ClosingRecord, Invoice, LineItem, ExpenseItem, MyProject } from "@/shared/types/closing";
import { formatCurrency, buildMonthOptions } from "@/frontend/constants/closing";
import { SelfReportCard } from "./self-report-card";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";

export function MemberBillingView({ memberId }: { memberId: string }) {
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
      downloadBlob(blob, filename);
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
        <Select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </Select>
      </div>

      {/* 月次工数自己申告 */}
      <SelfReportCard month={month} myProjects={myProjects} />

      {loading ? (
        <InlineSkeleton />
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
                              className="w-full px-2 py-1.5"
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
                  <Select
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
                  </Select>
                </div>
                {hasTransport === "yes" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      交通費は非課税です。SALT2の経費として計上されます。
                    </p>
                    {transports.map((tr) => (
                      <div key={tr.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={tr.description}
                          onChange={(e) => updateTransport(tr.id, "description", e.target.value)}
                          placeholder="説明（例: 渋谷→新宿 往復）"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <div className="w-28">
                          <input
                            type="number"
                            value={tr.amount === 0 ? "" : tr.amount}
                            onChange={(e) => updateTransport(tr.id, "amount", Number(e.target.value) || 0)}
                            placeholder="金額"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <span className="text-sm text-slate-500">円</span>
                        <button
                          onClick={() => removeTransport(tr.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
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
                  <Select
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
                  </Select>
                </div>
                {hasExpense === "yes" && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      経費は消費税がかかりません。プロジェクトを選択するとプロジェクト別PLに反映されます。未選択の場合はSALT2の業務経費として計上されます。
                    </p>
                    {expenses.map((exp) => (
                      <div key={exp.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
                        <div className="space-y-1">
                          <Select
                            value={exp.projectId}
                            onChange={(e) => updateExpense(exp.id, "projectId", e.target.value)}
                            className="w-full px-2 py-1.5"
                          >
                            <option value="">プロジェクト外（SALT2計上）</option>
                            {myProjects.map((p) => (
                              <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                            ))}
                          </Select>
                          <input
                            type="text"
                            value={exp.description}
                            onChange={(e) => updateExpense(exp.id, "description", e.target.value)}
                            placeholder="説明（例: 参考書代）"
                            className="w-full px-2 py-1.5"
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
