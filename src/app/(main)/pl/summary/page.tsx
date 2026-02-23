"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLChart = dynamic(
  () => import("@/components/charts/pl-chart").then((m) => m.PLChart),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded bg-slate-100" /> }
);

const PLTrendLine = dynamic(
  () => import("@/components/charts/pl-chart").then((m) => m.PLTrendLine),
  { ssr: false, loading: () => <div className="h-[200px] animate-pulse rounded bg-slate-100" /> }
);

// ─── 型定義 ──────────────────────────────────────────────

interface PLRecord {
  id: string;
  projectId: string;
  projectName: string;
  projectType: string;
  company: string;
  targetMonth: string;
  revenue: number;
  laborCost: number;
  toolCost: number;
  otherCost: number;
  grossProfit: number;
  grossMargin: number;
  markupRate: number | null;
}

type TabCompany = "合算" | "boost" | "salt2";

// ─── ユーティリティ ──────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}

function buildMonths(n = 6): string[] {
  const months: string[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months.reverse();
}

const MONTHS = buildMonths(6);

// ─── ページ ───────────────────────────────────────────────

export default function PLSummaryPage() {
  const [tab, setTab] = useState<TabCompany>("合算");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [allRecords, setAllRecords] = useState<PLRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/pl-records?months=${MONTHS.join(",")}`);
    if (res.ok) {
      setAllRecords(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentPL = allRecords.filter((p) => p.targetMonth === month);
  const filteredPL = tab === "合算" ? currentPL : currentPL.filter((p) => p.company === tab);

  const dispatchPL = filteredPL.filter((p) => p.projectType === "boost_dispatch");
  const ownPL = filteredPL.filter((p) => p.projectType === "salt2_own");

  const totalRevenue = filteredPL.reduce((s, p) => s + p.revenue, 0);
  const totalLaborCost = filteredPL.reduce((s, p) => s + p.laborCost, 0);
  const totalToolCost = filteredPL.reduce((s, p) => s + p.toolCost, 0);
  const totalOtherCost = filteredPL.reduce((s, p) => s + p.otherCost, 0);
  const totalGrossProfit = filteredPL.reduce((s, p) => s + p.grossProfit, 0);
  const grossMargin = totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100).toFixed(1) : "0";

  const dispatchLaborTotal = dispatchPL.reduce((s, p) => s + p.laborCost, 0);
  const dispatchRevenueTotal = dispatchPL.reduce((s, p) => s + p.revenue, 0);
  const dispatchToolTotal = dispatchPL.reduce((s, p) => s + p.toolCost, 0);
  const dispatchOtherTotal = dispatchPL.reduce((s, p) => s + p.otherCost, 0);
  const dispatchProfitTotal = dispatchPL.reduce((s, p) => s + p.grossProfit, 0);
  const breakevenMarkup = dispatchLaborTotal > 0
    ? (dispatchLaborTotal + dispatchOtherTotal) / dispatchLaborTotal
    : 0;
  const avgMarkup = dispatchPL.length > 0
    ? (dispatchPL.reduce((s, p) => s + (p.markupRate ?? 1.2), 0) / dispatchPL.length)
    : 1.2;

  const ownRevenueTotal = ownPL.reduce((s, p) => s + p.revenue, 0);
  const ownLaborTotal = ownPL.reduce((s, p) => s + p.laborCost, 0);
  const ownProfitTotal = ownPL.reduce((s, p) => s + p.grossProfit, 0);
  const ownMargin = ownRevenueTotal > 0 ? ((ownProfitTotal / ownRevenueTotal) * 100).toFixed(1) : "0";

  // トレンドデータ（6ヶ月）
  const buildTrendData = (company: "ALL" | "boost" | "salt2") =>
    MONTHS.map((m) => {
      const recs = allRecords.filter(
        (r) => r.targetMonth === m && (company === "ALL" || r.company === company)
      );
      return {
        month: m.replace("-", "/"),
        revenue: recs.reduce((s, r) => s + r.revenue, 0),
        grossProfit: recs.reduce((s, r) => s + r.grossProfit, 0),
        laborCost: recs.reduce((s, r) => s + r.laborCost, 0),
      };
    });

  const chartData =
    tab === "合算" ? buildTrendData("ALL") :
    tab === "boost" ? buildTrendData("boost") :
    buildTrendData("salt2");

  const TAB_LABELS: Record<TabCompany, string> = { "合算": "合算", "boost": "Boost", "salt2": "SALT2" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">PL サマリー</h1>
          <p className="text-sm text-slate-500">{month.replace("-", "年")}月 当月実績</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.slice().reverse().map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Tab */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        {(["合算", "boost", "salt2"] as TabCompany[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* ビジネスモデル説明 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(tab === "合算" || tab === "boost") && dispatchPL.length > 0 && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="warning" className="text-xs">Boost派遣</Badge>
                  <span className="text-xs text-orange-700 font-medium">コストパススルーモデル</span>
                </div>
                <p className="text-xs text-orange-700 mb-3">
                  Boostが案件獲得 → SALT2が人員派遣 → Boostへ「人件費 × 掛け率 ＋ ツール費（実費）」を請求
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Boost請求額合計</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(dispatchRevenueTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">コスト合計</p>
                    <p className="text-lg font-bold text-slate-600">
                      {formatCurrency(dispatchLaborTotal + dispatchToolTotal + dispatchOtherTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">平均掛け率</p>
                    <p className="text-lg font-bold text-orange-700">×{avgMarkup.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">損益分岐掛け率</p>
                    <p className="text-lg font-bold text-slate-700">×{breakevenMarkup.toFixed(2)}</p>
                  </div>
                </div>
                <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${dispatchProfitTotal >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  差益: {formatCurrency(dispatchProfitTotal)}
                  {dispatchProfitTotal >= 0 ? "（掛け率が損益分岐を上回っています）" : "（コスト超過 — 掛け率の引き上げを検討）"}
                </div>
              </div>
            )}

            {(tab === "合算" || tab === "salt2") && ownPL.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="info" className="text-xs">SALT2自社</Badge>
                  <span className="text-xs text-blue-700 font-medium">直接収益モデル</span>
                </div>
                <p className="text-xs text-blue-700 mb-3">
                  SALT2が案件を直接獲得 → クライアントから売上が入る → 通常の損益計算
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">売上合計</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(ownRevenueTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">人件費合計</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(ownLaborTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">粗利</p>
                    <p className={`text-lg font-bold ${ownProfitTotal >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatCurrency(ownProfitTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">粗利率</p>
                    <p className="text-lg font-bold text-blue-700">{ownMargin}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-xs text-slate-500">{tab === "boost" ? "Boost請求額" : "売上 / 請求額"}</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{formatCurrency(totalRevenue)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">差益 / 粗利</p>
              <p className="mt-1 text-xl font-bold text-green-700">{formatCurrency(totalGrossProfit)}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">差益 / 粗利率</p>
              <p className="mt-1 text-xl font-bold text-blue-700">{grossMargin}%</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">人件費</p>
              <p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(totalLaborCost)}</p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>月次推移（6ヶ月）</CardTitle>
              </CardHeader>
              <PLChart data={chartData} company={tab === "合算" ? "合算" : tab === "boost" ? "Boost" : "SALT2"} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>売上・差益トレンド</CardTitle>
              </CardHeader>
              <PLTrendLine data={chartData} />
            </Card>
          </div>

          {/* Project breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>プロジェクト別 PL（{month}）</CardTitle>
            </CardHeader>
            {filteredPL.length === 0 ? (
              <p className="text-sm text-slate-500">この月のデータがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr className="text-xs text-slate-500">
                      <th className="py-2 text-left font-medium">プロジェクト</th>
                      <th className="py-2 text-left font-medium">区分</th>
                      <th className="py-2 text-right font-medium">売上 / 請求額</th>
                      <th className="py-2 text-right font-medium">人件費</th>
                      <th className="py-2 text-right font-medium">ツール費</th>
                      <th className="py-2 text-right font-medium">その他</th>
                      <th className="py-2 text-right font-medium">差益 / 粗利</th>
                      <th className="py-2 text-right font-medium">掛け率 / 粗利率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPL.map((pl) => {
                      const isDispatch = pl.projectType === "boost_dispatch";
                      const markup = pl.markupRate ?? 1.2;
                      return (
                        <tr key={pl.projectId} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 font-medium text-slate-800">{pl.projectName}</td>
                          <td className="py-2">
                            {isDispatch ? (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">Boost派遣</span>
                            ) : (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">SALT2自社</span>
                            )}
                          </td>
                          <td className="py-2 text-right text-slate-700">{formatCurrency(pl.revenue)}</td>
                          <td className="py-2 text-right text-amber-700">{formatCurrency(pl.laborCost)}</td>
                          <td className="py-2 text-right text-slate-500">{formatCurrency(pl.toolCost)}</td>
                          <td className="py-2 text-right text-slate-500">{formatCurrency(pl.otherCost)}</td>
                          <td className={`py-2 text-right font-semibold ${pl.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {formatCurrency(pl.grossProfit)}
                          </td>
                          <td className="py-2 text-right">
                            {isDispatch ? (
                              <span className="text-xs font-medium text-orange-700">×{markup.toFixed(2)}</span>
                            ) : (
                              <span className={`text-xs font-medium ${pl.grossMargin >= 30 ? "text-green-600" : pl.grossMargin >= 20 ? "text-amber-600" : "text-red-600"}`}>
                                {pl.grossMargin.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200">
                    <tr>
                      <td className="py-2 font-bold text-slate-800" colSpan={2}>合計</td>
                      <td className="py-2 text-right font-bold text-slate-800">{formatCurrency(totalRevenue)}</td>
                      <td className="py-2 text-right font-bold text-amber-700">{formatCurrency(totalLaborCost)}</td>
                      <td className="py-2 text-right font-bold text-slate-500">{formatCurrency(totalToolCost)}</td>
                      <td className="py-2 text-right font-bold text-slate-500">{formatCurrency(totalOtherCost)}</td>
                      <td className="py-2 text-right font-bold text-green-700">{formatCurrency(totalGrossProfit)}</td>
                      <td className="py-2 text-right font-bold text-blue-700">{grossMargin}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* 会社別比較 */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {(["boost", "salt2"] as const).map((company) => {
              const companyPL = currentPL.filter((p) => p.company === company);
              const rev = companyPL.reduce((s, p) => s + p.revenue, 0);
              const gp = companyPL.reduce((s, p) => s + p.grossProfit, 0);
              const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : "0";
              const isDispatchCompany = company === "boost";

              return (
                <Card key={company}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={company === "boost" ? "boost" : "salt2"} className="text-sm px-3 py-1">
                        {company === "boost" ? "Boost" : "SALT2"}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {isDispatchCompany ? "派遣ビジネス" : "自社案件"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      {Number(margin) >= 10 ? (
                        <TrendingUp size={14} className="text-green-500" />
                      ) : (
                        <TrendingDown size={14} className="text-amber-500" />
                      )}
                      {isDispatchCompany ? `差益率 ${margin}%` : `粗利率 ${margin}%`}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">{isDispatchCompany ? "Boost請求額" : "売上"}</p>
                      <p className="text-lg font-bold text-slate-800">{formatCurrency(rev)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{isDispatchCompany ? "差益" : "粗利"}</p>
                      <p className={`text-lg font-bold ${gp >= 0 ? "text-green-700" : "text-red-600"}`}>{formatCurrency(gp)}</p>
                    </div>
                  </div>
                  {isDispatchCompany && dispatchPL.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-orange-600">
                      <ArrowRight size={12} />
                      <span>平均掛け率 ×{avgMarkup.toFixed(2)} 適用中</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
