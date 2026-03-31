"use client";
import { useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Save, CheckCircle, TrendingDown, TrendingUp, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Button } from "@/frontend/components/common/button";
import { Badge } from "@/frontend/components/common/badge";
import { useAuth } from "@/frontend/contexts/auth-context";
import { formatCurrency, buildMonths } from "@/shared/utils";
import { notFound } from "next/navigation";
import { DashboardPageSkeleton, InlineSkeleton } from "@/frontend/components/common/skeleton";

const CashflowChart = dynamic(
  () => import("@/frontend/components/domain/charts/cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false }
);

interface CfRecord {
  month: string;
  company: string;
  openingBalance: number;
  cashInClient: number;
  cashInOther: number;
  cashOutSalary: number;
  cashOutFixed: number;
  cashOutExpense: number;
  cashOutOther: number;
  cfBalanceCurrent: number;
  // 自動計算の参考値
  autoCashInClient?: number;
  autoCashOutSalary?: number;
  autoCashOutFixed?: number;
  autoCashOutExpense?: number;
  // オーバーライド状態
  overrides?: {
    cashInClient: boolean;
    cashOutSalary: boolean;
    cashOutFixed: boolean;
    cashOutExpense: boolean;
  };
}

// ローカル編集でのオーバーライド追跡
interface LocalOverrides {
  cashInClientOverride?: number | null;
  cashOutSalaryOverride?: number | null;
  cashOutFixedOverride?: number | null;
  cashOutExpenseOverride?: number | null;
}

const MONTHS = buildMonths(6);

function calcBalance(r: CfRecord) {
  const cashIn = r.cashInClient + r.cashInOther;
  const cashOut = r.cashOutSalary + r.cashOutFixed + r.cashOutExpense + r.cashOutOther;
  const net = cashIn - cashOut;
  const closingBalance = r.openingBalance + net;
  return { cashIn, cashOut, net, closingBalance };
}

function emptyRecord(month: string): CfRecord {
  return {
    month, company: "salt2",
    openingBalance: 0, cashInClient: 0, cashInOther: 0,
    cashOutSalary: 0, cashOutFixed: 0, cashOutExpense: 0, cashOutOther: 0,
    cfBalanceCurrent: 0,
  };
}

type AutoKey = "cashInClient" | "cashOutSalary" | "cashOutFixed" | "cashOutExpense";
type ManualKey = "cashInOther" | "cashOutOther" | "openingBalance";
type AllEditableKey = AutoKey | ManualKey;

const AUTO_TO_OVERRIDE: Record<AutoKey, keyof LocalOverrides> = {
  cashInClient: "cashInClientOverride",
  cashOutSalary: "cashOutSalaryOverride",
  cashOutFixed: "cashOutFixedOverride",
  cashOutExpense: "cashOutExpenseOverride",
};

export default function CashflowPage() {
  const { role, isLoading: authLoading } = useAuth();
  const [month, setMonth] = useState(MONTHS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localRecords, setLocalRecords] = useState<Record<string, CfRecord>>({});
  const [localOverrides, setLocalOverrides] = useState<Record<string, LocalOverrides>>({});

  const { data: rawCfData, isLoading: loading, mutate } = useSWR<CfRecord[]>(
    `/api/cashflow?months=${MONTHS.join(",")}`
  );
  const fetchedRecords: Record<string, CfRecord> = (() => {
    const map: Record<string, CfRecord> = {};
    if (rawCfData) {
      (Array.isArray(rawCfData) ? rawCfData : [rawCfData]).forEach((r) => { map[r.month] = r; });
    }
    return map;
  })();
  const records: Record<string, CfRecord> = { ...fetchedRecords, ...localRecords };

  if (authLoading || loading) return <DashboardPageSkeleton kpiCount={4} rows={5} cols={6} />;
  if (role !== "admin") return notFound();

  function getRecord(m: string): CfRecord {
    return records[m] ?? emptyRecord(m);
  }

  const current = getRecord(month);

  // フィールドがオーバーライドされているか判定
  function isOverridden(key: AutoKey): boolean {
    const lo = localOverrides[month];
    if (lo) {
      const overrideKey = AUTO_TO_OVERRIDE[key];
      if (lo[overrideKey] !== undefined) return lo[overrideKey] !== null;
    }
    return current.overrides?.[key] ?? false;
  }

  // 自動計算の参考値を取得
  function getAutoValue(key: AutoKey): number | undefined {
    const autoKey = `auto${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof CfRecord;
    return current[autoKey] as number | undefined;
  }

  function updateField(field: AllEditableKey, raw: string) {
    const value = raw === "" ? 0 : parseInt(raw.replace(/,/g, ""), 10);
    if (isNaN(value) || value < 0) return;

    const rec = records[month] ?? emptyRecord(month);
    setLocalRecords((prev) => ({
      ...prev,
      [month]: { ...rec, [field]: value },
    }));

    // 自動計算フィールドの場合、オーバーライドとして記録
    if (field in AUTO_TO_OVERRIDE) {
      const overrideKey = AUTO_TO_OVERRIDE[field as AutoKey];
      setLocalOverrides((prev) => ({
        ...prev,
        [month]: { ...(prev[month] ?? {}), [overrideKey]: value },
      }));
    }

    setSaved(false);
  }

  // オーバーライドを解除して自動計算に戻す
  function resetToAuto(key: AutoKey) {
    const autoVal = getAutoValue(key);
    if (autoVal == null) return;
    const rec = records[month] ?? emptyRecord(month);
    setLocalRecords((prev) => ({
      ...prev,
      [month]: { ...rec, [key]: autoVal },
    }));
    const overrideKey = AUTO_TO_OVERRIDE[key];
    setLocalOverrides((prev) => ({
      ...prev,
      [month]: { ...(prev[month] ?? {}), [overrideKey]: null },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const r = getRecord(month);
    const lo = localOverrides[month] ?? {};
    const res = await fetch("/api/cashflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        cashInOther: r.cashInOther,
        cashOutOther: r.cashOutOther,
        openingBalance: r.openingBalance,
        ...(lo.cashInClientOverride !== undefined ? { cashInClientOverride: lo.cashInClientOverride } : {}),
        ...(lo.cashOutSalaryOverride !== undefined ? { cashOutSalaryOverride: lo.cashOutSalaryOverride } : {}),
        ...(lo.cashOutFixedOverride !== undefined ? { cashOutFixedOverride: lo.cashOutFixedOverride } : {}),
        ...(lo.cashOutExpenseOverride !== undefined ? { cashOutExpenseOverride: lo.cashOutExpenseOverride } : {}),
      }),
    });
    if (res.ok) {
      const updated: CfRecord = await res.json();
      setLocalRecords((prev) => ({ ...prev, [month]: updated }));
      setLocalOverrides((prev) => ({ ...prev, [month]: {} }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      mutate();
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

  const clientInLabel = "クライアント入金";

  type RowDef = {
    label: string;
    key: AllEditableKey;
    type: "in" | "out";
    autoField?: boolean; // 自動計算フィールド
  };

  const rows: RowDef[] = [
    { label: clientInLabel,       key: "cashInClient",   type: "in",  autoField: true  },
    { label: "その他入金",         key: "cashInOther",    type: "in"                     },
    { label: "給与支払い",         key: "cashOutSalary",  type: "out", autoField: true  },
    { label: "固定費（ツール等）",  key: "cashOutFixed",   type: "out", autoField: true  },
    { label: "経費精算",           key: "cashOutExpense", type: "out", autoField: true  },
    { label: "その他支出",         key: "cashOutOther",   type: "out"                    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">キャッシュフロー管理</h1>
          <p className="text-sm text-slate-500">月次の入出金と残高推移を管理します</p>
        </div>
        <div className="flex items-center gap-2">
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
        <Badge variant="salt2">SALT2</Badge>
      </div>

      {loading ? (
        <InlineSkeleton />
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
                  onChange={(e) => updateField("openingBalance", e.target.value)}
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
                    const overridden = row.autoField ? isOverridden(row.key as AutoKey) : false;
                    const autoVal = row.autoField ? getAutoValue(row.key as AutoKey) : undefined;
                    return (
                      <tr key={row.key}>
                        <td className="py-2 pr-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${row.type === "in" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                            {row.type === "in" ? "イン" : "アウト"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            {row.label}
                            {row.autoField && !overridden && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">自動</span>
                            )}
                            {row.autoField && overridden && (
                              <button
                                onClick={() => resetToAuto(row.key as AutoKey)}
                                className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-600 hover:bg-amber-100 transition-colors"
                                title={`自動値に戻す（${formatCurrency(autoVal ?? 0)}）`}
                              >
                                手動 <RotateCcw size={10} />
                              </button>
                            )}
                          </div>
                          {row.autoField && overridden && autoVal != null && (
                            <p className="text-xs text-slate-400 mt-0.5">自動: {formatCurrency(autoVal)}</p>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            value={val}
                            onChange={(e) => updateField(row.key, e.target.value)}
                            className={`w-36 rounded-md border px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                              row.autoField && overridden ? "border-amber-300 bg-amber-50/50" : "border-slate-300"
                            }`}
                          />
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
                <CardTitle>残高推移グラフ</CardTitle>
              </CardHeader>
              <CashflowChart data={chartData} />
            </Card>
          </div>

          {/* All months overview */}
          <Card>
            <CardHeader>
              <CardTitle>月次サマリー</CardTitle>
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
