"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Save, CheckCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, buildMonths } from "@/lib/utils";
import { notFound } from "next/navigation";

const CashflowChart = dynamic(
  () => import("@/components/charts/cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false }
);

type Company = "boost" | "salt2";

interface CfRecord {
  month: string;
  company: string;
  openingBalance: number;
  cashInClient: number;    // 自動: 請求書から
  cashInOther: number;     // 手動
  cashOutSalary: number;   // 自動: 月給制メンバー合計
  cashOutFixed: number;    // 自動: ツールコスト合計
  cashOutExpense: number;  // 自動: 経費精算
  cashOutOther: number;    // 手動
  cfBalanceCurrent: number;
}

const MONTHS = buildMonths(6);

function calcBalance(r: CfRecord) {
  const cashIn = r.cashInClient + r.cashInOther;
  const cashOut = r.cashOutSalary + r.cashOutFixed + r.cashOutExpense + r.cashOutOther;
  const net = cashIn - cashOut;
  const closingBalance = r.openingBalance + net;
  return { cashIn, cashOut, net, closingBalance };
}

function emptyRecord(month: string, company: Company): CfRecord {
  return {
    month, company,
    openingBalance: 0, cashInClient: 0, cashInOther: 0,
    cashOutSalary: 0, cashOutFixed: 0, cashOutExpense: 0, cashOutOther: 0,
    cfBalanceCurrent: 0,
  };
}

export default function CashflowPage() {
  const { role } = useAuth();
  const [month, setMonth] = useState(MONTHS[0]);
  const [company, setCompany] = useState<Company>("boost");
  const [records, setRecords] = useState<Record<string, CfRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/cashflow?company=${company}&months=${MONTHS.join(",")}`);
    if (res.ok) {
      const data: CfRecord[] = await res.json();
      const map: Record<string, CfRecord> = {};
      (Array.isArray(data) ? data : [data]).forEach((r) => { map[r.month] = r; });
      setRecords(map);
    }
    setLoading(false);
  }, [company]);

  useEffect(() => { loadData(); }, [loadData]);

  if (role !== "admin") return notFound();

  function getRecord(m: string): CfRecord {
    return records[m] ?? emptyRecord(m, company);
  }

  const current = getRecord(month);

  function updateManual(field: "cashInOther" | "cashOutOther" | "openingBalance", raw: string) {
    const value = raw === "" ? 0 : parseInt(raw.replace(/,/g, ""), 10);
    if (isNaN(value) || value < 0) return;
    setRecords((prev) => ({
      ...prev,
      [month]: { ...(prev[month] ?? emptyRecord(month, company)), [field]: value },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const r = getRecord(month);
    const res = await fetch("/api/cashflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        company,
        cashInOther: r.cashInOther,
        cashOutOther: r.cashOutOther,
        openingBalance: r.openingBalance,
      }),
    });
    if (res.ok) {
      const updated: CfRecord = await res.json();
      setRecords((prev) => ({ ...prev, [month]: updated }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  function prevMonth() {
    const idx = MONTHS.indexOf(month);
    if (idx < MONTHS.length - 1) setMonth(MONTHS[idx + 1]);
  }
  function nextMonth() {
    const idx = MONTHS.indexOf(month);
    if (idx > 0) setMonth(MONTHS[idx - 1]);
  }

  // グラフ用: 古い月から新しい月へ（左→右）
  const chartData = [...MONTHS].reverse().map((m) => {
    const r = getRecord(m);
    const { closingBalance } = calcBalance(r);
    return { month: m.replace("-", "/"), 残高: closingBalance };
  });

  const { cashIn, cashOut, net, closingBalance } = calcBalance(current);

  // 会社によってラベルを切り替え
  const clientInLabel = company === "salt2" ? "クライアント入金" : "Boost入金";
  const companyLabel = company === "boost" ? "Boost" : "SALT2";

  type RowDef =
    | { label: string; key: "cashInClient" | "cashOutSalary" | "cashOutFixed" | "cashOutExpense"; type: "in" | "out"; editable: false }
    | { label: string; key: "cashInOther" | "cashOutOther" | "openingBalance"; type: "in" | "out"; editable: true };

  const rows: RowDef[] = [
    { label: clientInLabel,       key: "cashInClient",   type: "in",  editable: false },
    { label: "その他入金",         key: "cashInOther",    type: "in",  editable: true  },
    { label: "給与支払い",         key: "cashOutSalary",  type: "out", editable: false },
    { label: "固定費（ツール等）",  key: "cashOutFixed",   type: "out", editable: false },
    { label: "経費精算",           key: "cashOutExpense", type: "out", editable: false },
    { label: "その他支出",         key: "cashOutOther",   type: "out", editable: true  },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">キャッシュフロー管理</h1>
          <p className="text-sm text-slate-500">月次の入出金と残高推移を管理します</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value as Company)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="boost">Boost</option>
            <option value="salt2">SALT2</option>
          </select>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saved ? "保存済み" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevMonth}
          disabled={MONTHS.indexOf(month) >= MONTHS.length - 1}
          className="rounded-md border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-lg font-bold text-slate-800 min-w-[120px] text-center">
          {month.replace("-", "年")}月
        </span>
        <button
          onClick={nextMonth}
          disabled={MONTHS.indexOf(month) <= 0}
          className="rounded-md border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        <Badge variant={company === "boost" ? "boost" : "salt2"}>{companyLabel}</Badge>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-xs text-slate-500">前月繰越残高</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(current.openingBalance)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">キャッシュイン合計</p>
              <p className="mt-1 text-lg font-bold text-green-700">{formatCurrency(cashIn)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">キャッシュアウト合計</p>
              <p className="mt-1 text-lg font-bold text-red-700">{formatCurrency(cashOut)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">月末残高</p>
              <div className="flex items-center gap-1.5 mt-1">
                {closingBalance >= 0 ? (
                  <TrendingUp size={16} className="text-blue-500" />
                ) : (
                  <TrendingDown size={16} className="text-red-500" />
                )}
                <p className={`text-lg font-bold ${closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>
                  {formatCurrency(closingBalance)}
                </p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Input table */}
            <Card>
              <CardHeader>
                <CardTitle>入出金内訳</CardTitle>
              </CardHeader>

              {/* 前月繰越残高（手動） */}
              <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">前月繰越残高</span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={current.openingBalance}
                  onChange={(e) => updateManual("openingBalance", e.target.value)}
                  className="w-36 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left text-xs font-medium text-slate-500">区分</th>
                    <th className="pb-2 text-left text-xs font-medium text-slate-500">項目</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-500">金額（円）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => {
                    const val = current[row.key] as number;
                    return (
                      <tr key={row.key}>
                        <td className="py-2 pr-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${row.type === "in" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {row.type === "in" ? "イン" : "アウト"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-700">
                          {row.label}
                          {!row.editable && (
                            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">自動</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {row.editable ? (
                            <input
                              type="number"
                              min={0}
                              step={10000}
                              value={val}
                              onChange={(e) => updateManual(row.key as "cashInOther" | "cashOutOther", e.target.value)}
                              className="w-36 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="font-medium text-slate-700">{formatCurrency(val)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-200">
                    <td></td>
                    <td className="py-2 font-semibold text-slate-700">月次収支</td>
                    <td className={`py-2 text-right font-bold ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {net >= 0 ? "+" : ""}{formatCurrency(net)}
                    </td>
                  </tr>
                  <tr>
                    <td></td>
                    <td className="py-2 font-semibold text-slate-700">月末残高</td>
                    <td className={`py-2 text-right text-lg font-bold ${closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {formatCurrency(closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>

            {/* Balance trend chart */}
            <Card>
              <CardHeader>
                <CardTitle>残高推移グラフ（{companyLabel}）</CardTitle>
              </CardHeader>
              <CashflowChart data={chartData} />
            </Card>
          </div>

          {/* All months overview */}
          <Card>
            <CardHeader>
              <CardTitle>月次サマリー（{companyLabel}）</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left text-xs font-medium text-slate-500">月</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-500">期首残高</th>
                    <th className="pb-2 text-right text-xs font-medium text-green-600">入金合計</th>
                    <th className="pb-2 text-right text-xs font-medium text-red-600">支出合計</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-500">月次収支</th>
                    <th className="pb-2 text-right text-xs font-medium text-blue-600">月末残高</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {MONTHS.map((m) => {
                    const r = getRecord(m);
                    const { cashIn: ci, cashOut: co, net: n, closingBalance: cb } = calcBalance(r);
                    const isCurrent = m === month;
                    return (
                      <tr
                        key={m}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${isCurrent ? "bg-blue-50" : ""}`}
                        onClick={() => setMonth(m)}
                      >
                        <td className="py-2">
                          <span className={`font-medium ${isCurrent ? "text-blue-700" : "text-slate-700"}`}>
                            {m.replace("-", "年")}月
                          </span>
                        </td>
                        <td className="py-2 text-right text-slate-600">{formatCurrency(r.openingBalance)}</td>
                        <td className="py-2 text-right text-green-700">{formatCurrency(ci)}</td>
                        <td className="py-2 text-right text-red-700">{formatCurrency(co)}</td>
                        <td className={`py-2 text-right font-medium ${n >= 0 ? "text-green-700" : "text-red-700"}`}>
                          {n >= 0 ? "+" : ""}{formatCurrency(n)}
                        </td>
                        <td className={`py-2 text-right font-bold ${cb >= 0 ? "text-blue-700" : "text-red-700"}`}>
                          {formatCurrency(cb)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
