"use client";
import { Select } from "@/frontend/components/common/input";

import { useState } from "react";
import useSWR from "swr";
import { notFound } from "next/navigation";
import { useAuth } from "@/frontend/contexts/auth-context";
import { buildMonths } from "@/shared/utils";
import { EVALUATION_AXES, calcAxisAverage, type EvalScores } from "@/shared/constants/evaluation-taxonomy";

import type { EvalRow, OwnEval } from "@/shared/types/evaluation";
import { GradeBadge, AvgBadge } from "@/frontend/components/domain/evaluation/evaluation-score-display";
import { EditModal } from "@/frontend/components/domain/evaluation/evaluation-edit-modal";
import type { ModalState } from "@/frontend/components/domain/evaluation/evaluation-edit-modal";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";

const MONTHS = buildMonths(12);

export default function EvaluationPage() {
  const { role, memberId, isLoading: authLoading } = useAuth();
  const [month, setMonth] = useState(MONTHS[0]);
  const [modal, setModal] = useState<ModalState | null>(null);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canEdit = isAdmin;

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

  function openModal(row: EvalRow) {
    if (!canEdit) return;
    setModal({
      memberId: row.memberId,
      memberName: row.memberName,
      targetPeriod: month,
      scores: row.scores ?? {},
      comment: row.comment ?? "",
    });
  }

  function handleSaved(_updated: EvalRow) {
    // SWR will revalidate on next focus
  }

  // ---- 一般ユーザー用ビュー ----
  if (!isAdmin && !isManager) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-xl font-bold text-slate-800">人事評価</h1>

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
        <h1 className="text-xl font-bold text-slate-800">人事評価</h1>
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

      {loading ? (
        <InlineSkeleton />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">メンバーが見つかりません</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
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
              {rows.map((row) => (
                <tr key={row.memberId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.memberName}</td>
                  {row.evaluated ? (
                    <>
                      {EVALUATION_AXES.map((axis) => (
                        <td key={axis.id} className="px-3 py-3 text-center">
                          <AvgBadge avg={row.axisAverages?.[axis.key] ?? null} />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-semibold text-blue-700">
                        {row.totalAvg != null ? row.totalAvg.toFixed(2) : "—"}
                      </td>
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
                      <button
                        onClick={() => openModal(row)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {row.evaluated ? "編集" : "評価する"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <EditModal
          initial={modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
