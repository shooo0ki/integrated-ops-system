"use client";
import { Select } from "@/frontend/components/common/input";

import { useState } from "react";
import useSWR from "swr";
import { notFound, useSearchParams } from "next/navigation";
import { useAuth } from "@/frontend/contexts/auth-context";
import { buildMonths } from "@/shared/utils";
import { EVALUATION_AXES } from "@/shared/constants/evaluation-taxonomy";

import type { EvalRow, OwnEval } from "@/shared/types/evaluation";
import { GradeBadge, AvgBadge } from "@/frontend/components/domain/evaluation/evaluation-score-display";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";
import { EmptyState } from "@/frontend/components/common/empty-state";
import { ErrorAlert } from "@/frontend/components/common/error-alert";

const MONTHS = buildMonths(12);

export default function EvaluationPage() {
  const { role, memberId, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get("month") ?? MONTHS[0]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canEdit = isAdmin;

  const [sortKey, setSortKey] = useState<"name" | "total">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [evalFilter, setEvalFilter] = useState<"all" | "done" | "pending">("all");

  const adminKey = (isAdmin || isManager) ? `/api/evaluations?month=${month}` : null;
  const memberKey = (!isAdmin && !isManager && memberId) ? `/api/evaluations?month=${month}` : null;

  const { data: rowsData, isLoading: rowsLoading, error: rowsError } = useSWR<EvalRow[]>(adminKey);
  const { data: ownEvalData, isLoading: ownLoading, error: ownError } = useSWR<OwnEval>(memberKey);
  const rows = rowsData ?? [];
  const ownEval = ownEvalData ?? null;

  // authLoading中はSWRキーがnullなので、auth完了後にSWRが開始するまでの間もloading扱い
  const loading = authLoading || rowsLoading || ownLoading
    || (adminKey != null && rowsData === undefined && !rowsError)
    || (memberKey != null && ownEvalData === undefined && !ownError);

  if (!authLoading && role !== "admin" && role !== "manager" && role !== "member") {
    return notFound();
  }

  // ---- 一般ユーザー用ビュー ----
  if (!isAdmin && !isManager) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-xl font-bold text-slate-800">評価サマリー</h1>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">月:</label>
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <InlineSkeleton />
        ) : !ownEval ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <p className="text-slate-400">{month} の評価はまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">{ownEval.targetPeriod} の評価</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                総合 {ownEval.totalAvg != null ? ownEval.totalAvg.toFixed(2) : "—"}
              </span>
            </div>

            {EVALUATION_AXES.map((axis) => {
              const axisAvg = ownEval.axisAverages[axis.key];
              return (
                <div key={axis.id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{axis.label}</span>
                    <AvgBadge avg={axisAvg ?? null} />
                  </div>
                  <div className="space-y-1">
                    {axis.subCategories.map((sc) => (
                      <div key={sc.id}>
                        {sc.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-0.5">
                            <span className="text-xs text-slate-500">{item.label}</span>
                            <GradeBadge grade={(ownEval.scores[item.id] as "A"|"B"|"C"|"D") ?? null} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {ownEval.comment && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-400">コメント</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{ownEval.comment}</p>
              </div>
            )}

            <p className="text-right text-xs text-slate-400">
              更新: {new Date(ownEval.updatedAt).toLocaleString("ja-JP")}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---- 管理者・マネージャー用ビュー ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">評価サマリー</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">月:</label>
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "総メンバー", value: rows.length },
          { label: "評価済み", value: rows.filter((r) => r.evaluated).length },
          { label: "未評価", value: rows.filter((r) => !r.evaluated).length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {/* フィルター・ソート */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">表示:</span>
            {(["all", "done", "pending"] as const).map((v) => (
              <button key={v} onClick={() => setEvalFilter(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  evalFilter === v ? "bg-blue-600 text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}>
                {v === "all" ? "全員" : v === "done" ? "評価済み" : "未評価"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">並び順:</span>
            <button onClick={() => { setSortKey("name"); setSortAsc(true); }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                sortKey === "name" ? "bg-blue-600 text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}>名前</button>
            <button onClick={() => { if (sortKey === "total") { setSortAsc(!sortAsc); } else { setSortKey("total"); setSortAsc(false); } }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                sortKey === "total" ? "bg-blue-600 text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}>総合{sortKey === "total" ? (sortAsc ? " ↑" : " ↓") : ""}</button>
          </div>
        </div>
      )}

      {rowsError ? (
        <ErrorAlert message={`データ取得に失敗しました: ${rowsError.message}`} />
      ) : loading ? (
        <InlineSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState title="メンバーが見つかりません" description="対象月にメンバーが登録されていません" />
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[calc(100vh-320px)]">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">メンバー</th>
                {EVALUATION_AXES.map((axis) => (
                  <th key={axis.id} className="px-3 py-3 text-center font-medium whitespace-nowrap">
                    {axis.id}. {axis.key.charAt(0).toUpperCase() + axis.key.slice(1, 4)}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-medium">総合</th>
                <th className="px-4 py-3 text-left font-medium">コメント</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...rows]
                .filter((r) => evalFilter === "all" ? true : evalFilter === "done" ? r.evaluated : !r.evaluated)
                .sort((a, b) => {
                  if (sortKey === "total") {
                    const av = a.totalAvg ?? -1, bv = b.totalAvg ?? -1;
                    return sortAsc ? av - bv : bv - av;
                  }
                  return sortAsc ? a.memberName.localeCompare(b.memberName) : b.memberName.localeCompare(a.memberName);
                })
                .map((row) => (
                <tr key={row.memberId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.memberName}</td>
                  {row.evaluated ? (
                    <>
                      {EVALUATION_AXES.map((axis) => {
                        const avg = row.axisAverages?.[axis.key] ?? null;
                        const cellBg = avg == null ? "" : avg >= 3.0 ? "bg-green-50" : avg >= 2.0 ? "bg-blue-50" : avg >= 1.0 ? "bg-amber-50" : "bg-red-50";
                        return (
                          <td key={axis.id} className={`px-3 py-3 text-center ${cellBg}`}>
                            <AvgBadge avg={avg} />
                          </td>
                        );
                      })}
                      {(() => {
                        const avg = row.totalAvg;
                        const cellBg = avg == null ? "" : avg >= 3.0 ? "bg-green-50" : avg >= 2.0 ? "bg-blue-50" : avg >= 1.0 ? "bg-amber-50" : "bg-red-50";
                        return (
                          <td className={`px-3 py-3 text-center font-semibold ${cellBg}`}>
                            <AvgBadge avg={avg ?? null} />
                          </td>
                        );
                      })()}
                      <td className="max-w-xs px-4 py-3 text-slate-500 truncate">
                        {row.comment ?? "—"}
                      </td>
                    </>
                  ) : (
                    <td colSpan={EVALUATION_AXES.length + 2} className="px-4 py-3 text-center text-slate-400">
                      未評価
                    </td>
                  )}
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/evaluation/${row.memberId}?month=${month}`}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {row.evaluated ? "編集" : "評価する"} →
                      </a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
