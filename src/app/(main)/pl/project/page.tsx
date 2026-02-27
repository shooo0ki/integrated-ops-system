"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

const ProjectPLAreaChart = dynamic(
  () => import("@/components/charts/pl-chart").then((m) => m.ProjectPLAreaChart),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded bg-slate-100" /> }
);

// ─── 型定義 ──────────────────────────────────────────────

interface PLRecord {
  id: string;
  projectId: string;
  projectName: string;
  projectType: string;
  company: string;
  projectStatus: string;
  clientName: string | null;
  targetMonth: string;
  revenue: number;
  revenueContract: number;
  revenueExtra: number;
  laborCost: number;
  toolCost: number;
  otherCost: number;
  grossProfit: number;
  grossMargin: number;
  markupRate: number | null;
}

interface ProjectTab {
  id: string;
  name: string;
  company: string;
  projectType: string;
}

// ─── ユーティリティ ──────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}

// 過去6ヶ月の YYYY-MM リストを生成
function buildMonths(n = 6): string[] {
  const months: string[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

const MONTHS = buildMonths(6); // 新しい順（index 0 = 当月）

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-slate-800 px-5 py-3 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white">✕</button>
    </div>
  );
}

// ─── ページ ───────────────────────────────────────────────

export default function ProjectPLPage() {
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "manager";

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [projects, setProjects] = useState<ProjectTab[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [allRecords, setAllRecords] = useState<PLRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [simMarkup, setSimMarkup] = useState<string>("");
  const [otherCostInput, setOtherCostInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // プロジェクト一覧（全PLレコードから一意に取得）
  const loadProjects = useCallback(async () => {
    const res = await fetch(`/api/pl-records?months=${MONTHS.join(",")}`);
    if (!res.ok) return;
    const records: PLRecord[] = await res.json();
    setAllRecords(records);

    // 一意のプロジェクトを抽出
    const seen = new Set<string>();
    const tabs: ProjectTab[] = [];
    records.forEach((r) => {
      if (!seen.has(r.projectId)) {
        seen.add(r.projectId);
        tabs.push({ id: r.projectId, name: r.projectName, company: r.company, projectType: r.projectType });
      }
    });
    setProjects(tabs);
    if (tabs.length > 0 && !selectedProjectId) {
      setSelectedProjectId(tabs[0].id);
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const currentRecord = allRecords.find(
    (r) => r.targetMonth === selectedMonth && r.projectId === selectedProjectId
  );

  const trendData = MONTHS.map((month) => {
    const rec = allRecords.find((r) => r.targetMonth === month && r.projectId === selectedProjectId);
    return {
      month: month.replace("-", "/"),
      revenue: rec?.revenue ?? 0,
      laborCost: rec?.laborCost ?? 0,
      grossProfit: rec?.grossProfit ?? 0,
    };
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const isBoostDispatch = currentRecord?.projectType === "boost_dispatch";
  const breakevenMarkup = currentRecord && currentRecord.laborCost > 0
    ? (currentRecord.laborCost + currentRecord.otherCost) / currentRecord.laborCost
    : 1.0;
  const actualMarkup = currentRecord?.markupRate ?? breakevenMarkup;
  const simRate = simMarkup !== "" ? Number(simMarkup) : actualMarkup;

  const simRevenue = currentRecord
    ? currentRecord.laborCost * simRate + currentRecord.toolCost
    : 0;
  const totalCost = currentRecord
    ? currentRecord.laborCost + currentRecord.toolCost + currentRecord.otherCost
    : 0;
  const simProfit = simRevenue - totalCost;

  const grossMarginStr = currentRecord
    ? currentRecord.revenue > 0
      ? ((currentRecord.grossProfit / currentRecord.revenue) * 100).toFixed(1)
      : "0"
    : "0";

  async function handleSaveOtherCost() {
    if (!currentRecord || !otherCostInput) return;
    setSaving(true);
    const newOtherCost = Number(otherCostInput);
    const res = await fetch("/api/pl-records", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: currentRecord.projectId,
        targetMonth: currentRecord.targetMonth,
        revenueContract: currentRecord.revenueContract,
        revenueExtra: currentRecord.revenueExtra,
        costLaborMonthly: currentRecord.laborCost,
        costTools: currentRecord.toolCost,
        costOther: newOtherCost,
        markupRate: currentRecord.markupRate,
      }),
    });
    setSaving(false);
    if (res.ok) {
      showToast("コストを保存しました");
      setOtherCostInput("");
      await loadProjects();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">プロジェクト別 PL</h1>
        </div>
        <div className="py-12 text-center text-sm text-slate-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">プロジェクト別 PL</h1>
          <p className="text-sm text-slate-500">プロジェクトごとの損益明細</p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setSimMarkup(""); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {projects.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">PLレコードがありません。</p>
          <p className="mt-1 text-xs text-slate-400">PL サマリーページの「PL自動集計」ボタンで稼働申告から自動生成できます。</p>
        </Card>
      ) : (
        <>
          {/* プロジェクト選択タブ */}
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => { setSelectedProjectId(project.id); setSimMarkup(""); }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedProjectId === project.id
                    ? "bg-white shadow text-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>

          {/* プロジェクト情報バッジ */}
          {selectedProject && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={selectedProject.company === "boost" ? "boost" : "salt2"}>
                {selectedProject.company === "boost" ? "Boost" : "SALT2"}
              </Badge>
              {currentRecord?.clientName && (
                <span className="text-sm text-slate-500">クライアント: {currentRecord.clientName}</span>
              )}
              {isBoostDispatch && (
                <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                  Boost派遣（コストパススルーモデル）
                </span>
              )}
              {selectedProject.projectType === "salt2_own" && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  SALT2自社案件（直接収益モデル）
                </span>
              )}
            </div>
          )}

          {/* KPI カード */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <p className="text-xs text-slate-500">{isBoostDispatch ? "Boost請求額" : "売上"}</p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {currentRecord ? formatCurrency(currentRecord.revenue) : "—"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">人件費</p>
              <p className="mt-1 text-lg font-bold text-amber-700">
                {currentRecord ? formatCurrency(currentRecord.laborCost) : "—"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">ツール費</p>
              <p className="mt-1 text-lg font-bold text-slate-600">
                {currentRecord ? formatCurrency(currentRecord.toolCost) : "—"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">その他</p>
              <p className="mt-1 text-lg font-bold text-slate-600">
                {currentRecord ? formatCurrency(currentRecord.otherCost) : "—"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">{isBoostDispatch ? "差益（余剰）" : "粗利"}</p>
              <p className={`mt-1 text-lg font-bold ${(currentRecord?.grossProfit ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                {currentRecord ? formatCurrency(currentRecord.grossProfit) : "—"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-500">{isBoostDispatch ? "差益率" : "粗利率"}</p>
              <p className={`mt-1 text-lg font-bold ${Number(grossMarginStr) >= 20 ? "text-green-700" : Number(grossMarginStr) >= 5 ? "text-amber-600" : "text-red-600"}`}>
                {grossMarginStr}%
              </p>
            </Card>
          </div>

          {/* Boost派遣 掛け率分析 */}
          {isBoostDispatch && currentRecord && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-orange-800">掛け率分析（Boost派遣モデル）</h3>
                <span className="text-xs text-orange-600">請求 = 人件費 × 掛け率 ＋ ツール費（実費計上）</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white px-4 py-3 border border-orange-100">
                  <p className="text-xs text-slate-500">現在の掛け率</p>
                  <p className="mt-1 text-2xl font-bold text-orange-700">×{actualMarkup.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">= 人件費の{((actualMarkup - 1) * 100).toFixed(0)}%上乗せ</p>
                </div>
                <div className="rounded-lg bg-white px-4 py-3 border border-orange-100">
                  <p className="text-xs text-slate-500">損益分岐掛け率</p>
                  <p className="mt-1 text-2xl font-bold text-slate-700">×{breakevenMarkup.toFixed(2)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">= (人件費＋その他) / 人件費</p>
                </div>
                <div className={`rounded-lg px-4 py-3 border ${currentRecord.grossProfit >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                  <p className="text-xs text-slate-500">余剰（差益）</p>
                  <p className={`mt-1 text-2xl font-bold ${currentRecord.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {formatCurrency(currentRecord.grossProfit)}
                  </p>
                </div>
              </div>

              {/* 掛け率シミュレーター */}
              <div className="rounded-lg bg-white border border-orange-100 px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-slate-700">掛け率シミュレーター</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">掛け率：</span>
                    <input
                      type="number" step="0.01" min="1.00" max="2.00"
                      value={simMarkup !== "" ? simMarkup : actualMarkup}
                      onChange={(e) => setSimMarkup(e.target.value)}
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-sm text-slate-400">（{breakevenMarkup.toFixed(2)} 以上で黒字）</span>
                  </div>
                  <div className="flex gap-2">
                    {[breakevenMarkup, 1.10, 1.20, 1.30].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setSimMarkup(rate.toFixed(2))}
                        className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-orange-50 hover:border-orange-300"
                      >
                        ×{rate.toFixed(2)}
                      </button>
                    ))}
                    <button onClick={() => setSimMarkup("")} className="text-xs text-slate-400 hover:text-slate-600 px-1">リセット</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">シミュレート請求額</p>
                    <p className="font-bold text-slate-800">{formatCurrency(simRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">総コスト</p>
                    <p className="font-bold text-slate-600">{formatCurrency(totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">予測差益</p>
                    <p className={`font-bold ${simProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatCurrency(simProfit)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 月次推移グラフ */}
          <Card>
            <CardHeader>
              <CardTitle>月次推移（全期間）</CardTitle>
            </CardHeader>
            <div className="h-[280px]">
              <ProjectPLAreaChart data={trendData} />
            </div>
          </Card>

          {/* 費用内訳テーブル */}
          <Card>
            <CardHeader>
              <CardTitle>費用内訳（{selectedMonth}）</CardTitle>
            </CardHeader>
            {currentRecord ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr className="text-xs text-slate-500">
                      <th className="py-2 text-left font-medium">費用区分</th>
                      <th className="py-2 text-right font-medium">金額</th>
                      <th className="py-2 text-right font-medium">{isBoostDispatch ? "請求額比" : "売上比"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "人件費", value: currentRecord.laborCost, color: "text-amber-700" },
                      { label: "ツール費（実費計上）", value: currentRecord.toolCost, color: "text-slate-600" },
                      { label: "その他費用", value: currentRecord.otherCost, color: "text-slate-600" },
                    ].map(({ label, value, color }) => (
                      <tr key={label} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 text-slate-700">{label}</td>
                        <td className={`py-2 text-right ${color}`}>{formatCurrency(value)}</td>
                        <td className="py-2 text-right text-xs text-slate-500">
                          {currentRecord.revenue > 0
                            ? ((value / currentRecord.revenue) * 100).toFixed(1) + "%"
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-700 font-medium">費用合計</td>
                      <td className="py-2 text-right font-semibold text-slate-800">
                        {formatCurrency(totalCost)}
                      </td>
                      <td className="py-2 text-right text-xs text-slate-500">
                        {currentRecord.revenue > 0
                          ? ((totalCost / currentRecord.revenue) * 100).toFixed(1) + "%"
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200">
                    <tr>
                      <td className="py-2 font-bold text-slate-800">{isBoostDispatch ? "差益（余剰）" : "粗利"}</td>
                      <td className={`py-2 text-right font-bold ${currentRecord.grossProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatCurrency(currentRecord.grossProfit)}
                      </td>
                      <td className="py-2 text-right text-xs font-bold text-blue-700">{grossMarginStr}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">選択した月のデータがありません</p>
            )}
          </Card>

          {/* コスト手入力（admin / manager のみ） */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>手動コスト追記</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  請求書に含まれない追加コスト（交通費・雑費など）を手動で入力できます。
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600">その他コスト（円）</label>
                    <input
                      type="number"
                      value={otherCostInput}
                      onChange={(e) => setOtherCostInput(e.target.value)}
                      placeholder="例: 15000"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <Button variant="primary" onClick={handleSaveOtherCost} disabled={saving || !currentRecord}>
                    {saving ? "保存中..." : "保存する"}
                  </Button>
                </div>
                {currentRecord && (
                  <p className="text-xs text-slate-400">
                    現在のその他費用: {formatCurrency(currentRecord.otherCost)}
                  </p>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
