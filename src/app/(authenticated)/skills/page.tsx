"use client";
import { Select } from "@/frontend/components/common/input";

import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { buildMonths } from "@/shared/utils";
import {
  EVALUATION_AXES,
  GRADES,
  GRADE_LABELS,
  type ScoreGrade,
} from "@/shared/constants/evaluation-taxonomy";
import type { EvalRow } from "@/shared/types/evaluation";
import { GradeBadge } from "@/frontend/components/domain/evaluation/evaluation-score-display";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";
import { EmptyState } from "@/frontend/components/common/empty-state";
import { ErrorAlert } from "@/frontend/components/common/error-alert";

const MONTHS = buildMonths(12);

const GRADE_BG: Record<string, string> = {
  A: "bg-green-50",
  B: "bg-blue-50",
  C: "bg-amber-50",
  D: "bg-red-50",
};

// 全小項目をフラット化
const ALL_ITEMS = EVALUATION_AXES.flatMap((axis) =>
  axis.subCategories.flatMap((sc) =>
    sc.items.map((item) => ({ ...item, axisId: axis.id, axisKey: axis.key, scId: sc.id, scLabel: sc.label }))
  )
);

export default function SkillsPage() {
  const { role, isLoading: authLoading } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canEdit = isAdmin;

  const [month, setMonth] = useState(MONTHS[0]);

  const adminKey = (isAdmin || isManager) ? `/api/skills?month=${month}` : null;
  const { data: rowsData, isLoading: rowsLoading, error: rowsError } = useSWR<EvalRow[]>(adminKey);
  const rows = rowsData ?? [];
  const loading = authLoading || rowsLoading || (adminKey != null && rowsData === undefined && !rowsError);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">スキルマトリクス</h1>
          <p className="text-sm text-slate-500">5軸評価の全メンバー一覧</p>
        </div>
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-500">評価:</span>
        {GRADES.map((g) => (
          <span key={g} className="flex items-center gap-1 text-xs">
            <GradeBadge grade={g} />
            <span className="text-slate-500">{GRADE_LABELS[g]}</span>
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs">
          <GradeBadge grade={null} />
          <span className="text-slate-500">未評価</span>
        </span>
      </div>

      {/* Matrix */}
      {rowsError ? (
        <ErrorAlert message={`データ取得に失敗しました: ${rowsError.message}`} />
      ) : loading ? (
        <InlineSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState title="メンバーが見つかりません" description="対象月に評価データがありません" />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-auto max-h-[calc(100vh-280px)]">
          <table className="text-sm border-collapse min-w-max">
            <thead className="sticky top-0 z-20">
              {/* 軸ヘッダ行 */}
              <tr className="bg-slate-50">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 bg-slate-50 border border-slate-200 px-4 py-2 text-left text-xs font-semibold text-slate-600 min-w-[140px]"
                >
                  メンバー
                </th>
                {EVALUATION_AXES.map((axis) => {
                  const itemCount = axis.subCategories.reduce((s, sc) => s + sc.items.length, 0);
                  return (
                    <th
                      key={axis.id}
                      colSpan={itemCount}
                      className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-100"
                    >
                      {axis.id}. {axis.key.charAt(0).toUpperCase() + axis.key.slice(1)}
                    </th>
                  );
                })}
              </tr>
              {/* 小項目ヘッダ行 */}
              <tr className="bg-white">
                {ALL_ITEMS.map((item) => (
                  <th
                    key={item.id}
                    className="border border-slate-100 px-1.5 py-1.5 text-center text-[10px] font-medium text-slate-500 whitespace-nowrap min-w-[56px]"
                    title={`${item.scLabel} > ${item.label}`}
                  >
                    {item.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.memberId} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white border border-slate-200 px-4 py-2 font-medium text-slate-700 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {row.memberName}
                      {canEdit && (
                        <a
                          href={`/evaluation/${row.memberId}?month=${month}`}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          評価 →
                        </a>
                      )}
                    </span>
                  </td>
                  {row.evaluated ? (
                    ALL_ITEMS.map((item) => {
                      const grade = (row.scores?.[item.id] as ScoreGrade) ?? null;
                      return (
                        <td
                          key={item.id}
                          className={`border border-slate-100 px-1 py-1.5 text-center ${grade ? GRADE_BG[grade] ?? "" : ""}`}
                        >
                          <GradeBadge grade={grade} />
                        </td>
                      );
                    })
                  ) : (
                    <td colSpan={ALL_ITEMS.length} className="border border-slate-100 px-4 py-2 text-center text-slate-400 text-xs">
                      未評価
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
