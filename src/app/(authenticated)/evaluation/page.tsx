"use client";

import { useState } from "react";
import useSWR from "swr";
import { notFound } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildMonths } from "@/lib/utils";

import type { EvalRow, OwnEval } from "@/types/evaluation";
import { StarBar, ScoreBadge } from "@/components/domain/evaluation/star-bar";
import { EditModal } from "@/components/domain/evaluation/edit-modal";
import type { ModalState } from "@/components/domain/evaluation/edit-modal";

const MONTHS = buildMonths(12);

export default function EvaluationPage() {
  const { role, memberId } = useAuth();
  const [month, setMonth] = useState(MONTHS[0]);
  const [modal, setModal] = useState<ModalState | null>(null);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canEdit = isAdmin;

  const { data: rows = [], isLoading: rowsLoading } = useSWR<EvalRow[]>(
    (isAdmin || isManager) ? `/api/evaluations?month=${month}` : null
  );
  const { data: ownEval = null, isLoading: ownLoading } = useSWR<OwnEval>(
    (!isAdmin && !isManager && memberId) ? `/api/evaluations?month=${month}` : null
  );
  const loading = rowsLoading || ownLoading;

  if (role !== "admin" && role !== "manager" && role !== "member") {
    return notFound();
  }

  function openModal(row: EvalRow) {
    if (!canEdit) return;
    setModal({
      memberId: row.memberId,
      memberName: row.memberName,
      targetPeriod: month,
      scoreP: row.scoreP ?? 3,
      scoreA: row.scoreA ?? 3,
      scoreS: row.scoreS ?? 3,
      comment: row.comment ?? "",
    });
  }

  function handleSaved(_updated: EvalRow) {
    // SWR will revalidate on next focus
  }

  // ---- 一般ユーザー用ビュー ----
  if (!isAdmin && !isManager) {
    return (
      <div className="mx-auto max-w-xl space-y-6 p-6">
        <h1 className="text-xl font-bold text-slate-800">人事評価</h1>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">月:</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">読み込み中...</p>
        ) : !ownEval ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <p className="text-slate-400">{month} の評価はまだありません</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">{ownEval.targetPeriod} の評価</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                総合 {ownEval.totalAvg.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3">
              {[
                { key: "P", label: "Professional", score: ownEval.scoreP, labelTxt: ownEval.labelP },
                { key: "A", label: "Appearance", score: ownEval.scoreA, labelTxt: ownEval.labelA },
                { key: "S", label: "Skill", score: ownEval.scoreS, labelTxt: ownEval.labelS },
              ].map(({ key, label, score, labelTxt }) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-28 text-sm text-slate-500">{label}</span>
                  <StarBar score={score} />
                  <ScoreBadge score={score} label={labelTxt ?? ""} />
                </div>
              ))}
            </div>

            {ownEval.comment && (
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-400">コメント</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{ownEval.comment}</p>
              </div>
            )}

            <p className="mt-4 text-right text-xs text-slate-400">
              更新: {new Date(ownEval.updatedAt).toLocaleString("ja-JP")}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---- 管理者・マネージャー用ビュー ----

  function renderTable(label: string, tableRows: EvalRow[]) {
    return (
      <div key={label}>
        <h2 className="mb-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">メンバー</th>
                <th className="px-4 py-3 text-center font-medium">P</th>
                <th className="px-4 py-3 text-center font-medium">A</th>
                <th className="px-4 py-3 text-center font-medium">S</th>
                <th className="px-4 py-3 text-center font-medium">総合</th>
                <th className="px-4 py-3 text-left font-medium">コメント</th>
                <th className="px-4 py-3 text-center font-medium">更新日</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((row) => (
                <tr key={row.memberId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{row.memberName}</td>
                  {row.evaluated ? (
                    <>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge score={row.scoreP!} label={row.labelP!} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge score={row.scoreA!} label={row.labelA!} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge score={row.scoreS!} label={row.labelS!} />
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-700">
                        {row.totalAvg?.toFixed(2)}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-500 truncate">
                        {row.comment ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("ja-JP") : "—"}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-4 py-3 text-center text-slate-400">
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
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">人事評価</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">月:</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
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
        <p className="text-sm text-slate-400">読み込み中...</p>
      ) : (
        <div className="space-y-6">
          {rows.length > 0 ? renderTable("全メンバー", rows) : (
            <p className="text-sm text-slate-400">メンバーが見つかりません</p>
          )}
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
