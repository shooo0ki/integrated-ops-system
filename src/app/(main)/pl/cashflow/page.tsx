"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Save, CheckCircle, TrendingDown, TrendingUp } from "lucide-react";
import { CASHFLOW_RECORDS, formatCurrency, type Company, type CashflowRecord } from "@/lib/mock-data";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { notFound } from "next/navigation";

const CashflowChart = dynamic(
  () => import("@/components/charts/cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false }
);

const MONTHS = [
  "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
];

function calcBalance(r: CashflowRecord) {
  const cashIn = r.cashInClient + r.cashInOther;
  const cashOut = r.cashOutSalary + r.cashOutFreelance + r.cashOutFixed + r.cashOutOther;
  const net = cashIn - cashOut;
  const closingBalance = r.openingBalance + net;
  return { cashIn, cashOut, net, closingBalance };
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${y}/${mo}`;
}

export default function CashflowPage() {
  const { role } = useAuth();
  const [month, setMonth] = useState("2026-02");
  const [company, setCompany] = useState<Company>("Boost");
  const [saved, setSaved] = useState(false);

  // Local editable state per company+month
  const [records, setRecords] = useState<CashflowRecord[]>(() =>
    CASHFLOW_RECORDS.map((r) => ({ ...r }))
  );

  if (role !== "admin") return notFound();

  function getRecord(m: string, co: Company): CashflowRecord | undefined {
    return records.find((r) => r.month === m && r.company === co);
  }

  const current = getRecord(month, company);

  function updateField(field: keyof CashflowRecord, raw: string) {
    const value = raw === "" ? 0 : parseInt(raw.replace(/,/g, ""), 10);
    if (isNaN(value) || value < 0) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.month === month && r.company === company
          ? { ...r, [field]: value }
          : r
      )
    );
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function prevMonth() {
    const idx = MONTHS.indexOf(month);
    if (idx > 0) setMonth(MONTHS[idx - 1]);
  }

  function nextMonth() {
    const idx = MONTHS.indexOf(month);
    if (idx < MONTHS.length - 1) setMonth(MONTHS[idx + 1]);
  }

  // Build chart data (all months, selected company)
  const chartData: { month: string; 残高: number }[] = MONTHS.map((m) => {
    const r = getRecord(m, company);
    if (!r) return { month: monthLabel(m), 残高: 0 };
    const { closingBalance } = calcBalance(r);
    return { month: monthLabel(m), 残高: closingBalance };
  });

  const { cashIn, cashOut, net, closingBalance } = current
    ? calcBalance(current)
    : { cashIn: 0, cashOut: 0, net: 0, closingBalance: 0 };

  const rows: { label: string; key: keyof CashflowRecord; type: "in" | "out" | "auto"; editable: boolean }[] = [
    { label: "クライアント入金", key: "cashInClient", type: "in", editable: true },
    { label: "その他入金", key: "cashInOther", type: "in", editable: true },
    { label: "給与支払い", key: "cashOutSalary", type: "out", editable: false },
    { label: "外注費支払い", key: "cashOutFreelance", type: "out", editable: true },
    { label: "固定費", key: "cashOutFixed", type: "out", editable: true },
    { label: "その他支出", key: "cashOutOther", type: "out", editable: true },
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
            <option value="Boost">Boost</option>
            <option value="SALT2">SALT2</option>
          </select>
          <Button variant="primary" size="sm" onClick={handleSave}>
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saved ? "保存済み" : "保存"}
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevMonth}
          disabled={MONTHS.indexOf(month) === 0}
          className="rounded-md border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-lg font-bold text-slate-800 min-w-[120px] text-center">
          {month.replace("-", "年")}月
        </span>
        <button
          onClick={nextMonth}
          disabled={MONTHS.indexOf(month) === MONTHS.length - 1}
          className="rounded-md border border-slate-300 p-2 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
        <Badge variant={company === "Boost" ? "boost" : "salt2"}>{company}</Badge>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">前月繰越残高</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(current?.openingBalance ?? 0)}</p>
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
                const val = current ? (current[row.key] as number) : 0;
                return (
                  <tr key={row.key}>
                    <td className="py-2 pr-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.type === "in"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.type === "in" ? "イン" : "アウト"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {row.label}
                      {!row.editable && (
                        <span className="ml-1 text-xs text-slate-400">（自動）</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.editable ? (
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={val}
                          onChange={(e) => updateField(row.key, e.target.value)}
                          className="w-36 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-medium text-slate-700">{formatCurrency(val)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Net */}
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
            <CardTitle>残高推移グラフ（{company}）</CardTitle>
          </CardHeader>
          <CashflowChart data={chartData} />
        </Card>
      </div>

      {/* All months overview */}
      <Card>
        <CardHeader>
          <CardTitle>月次サマリー（{company}）</CardTitle>
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
                const r = getRecord(m, company);
                if (!r) return null;
                const { cashIn, cashOut, net, closingBalance } = calcBalance(r);
                const isCurrentMonth = m === month;
                return (
                  <tr
                    key={m}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                      isCurrentMonth ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setMonth(m)}
                  >
                    <td className="py-2">
                      <span className={`font-medium ${isCurrentMonth ? "text-blue-700" : "text-slate-700"}`}>
                        {m.replace("-", "年")}月
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600">{formatCurrency(r.openingBalance)}</td>
                    <td className="py-2 text-right text-green-700">{formatCurrency(cashIn)}</td>
                    <td className="py-2 text-right text-red-700">{formatCurrency(cashOut)}</td>
                    <td className={`py-2 text-right font-medium ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {net >= 0 ? "+" : ""}{formatCurrency(net)}
                    </td>
                    <td className={`py-2 text-right font-bold ${closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {formatCurrency(closingBalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
