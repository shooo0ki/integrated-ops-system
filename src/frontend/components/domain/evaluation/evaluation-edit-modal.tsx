"use client";

import { useState } from "react";
import {
  EVALUATION_AXES,
  GRADES,
  GRADE_LABELS,
  calcAxisAverage,
  calcTotalAverage,
  type EvalScores,
  type ScoreGrade,
} from "@/shared/constants/evaluation-taxonomy";
import type { EvalRow } from "@/shared/types/evaluation";

export type ModalState = {
  memberId: string;
  memberName: string;
  targetPeriod: string;
  scores: EvalScores;
  comment: string;
};

const GRADE_COLORS: Record<ScoreGrade, string> = {
  A: "bg-green-600 text-white",
  B: "bg-blue-600 text-white",
  C: "bg-slate-500 text-white",
  D: "bg-red-500 text-white",
};

export function EditModal({
  initial,
  onClose,
  onSaved,
  apiEndpoint = "/api/evaluations",
  title = "人事評価",
}: {
  initial: ModalState;
  onClose: () => void;
  onSaved: (row: EvalRow) => void;
  apiEndpoint?: string;
  title?: string;
}) {
  const [scores, setScores] = useState<EvalScores>({ ...initial.scores });
  const [comment, setComment] = useState(initial.comment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedAxis, setExpandedAxis] = useState<number | null>(null);

  const totalAvg = calcTotalAverage(scores);

  function setGrade(itemId: string, grade: ScoreGrade | null) {
    setScores((prev) => ({ ...prev, [itemId]: grade }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: initial.memberId,
          targetPeriod: initial.targetPeriod,
          scores,
          comment: comment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "保存に失敗しました");
        return;
      }
      onSaved({
        memberId: initial.memberId,
        memberName: initial.memberName,
        evaluated: true,
        id: data.id,
        targetPeriod: data.targetPeriod,
        scores: data.scores,
        axisAverages: data.axisAverages,
        totalAvg: data.totalAvg,
        comment: data.comment,
        updatedAt: data.updatedAt,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-bold text-slate-800">{title} — {initial.memberName}</h2>
        <p className="mb-4 text-sm text-slate-500">対象月: {initial.targetPeriod}</p>

        {/* 総合スコア */}
        <div className="mb-4 rounded-lg bg-slate-50 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-slate-500">総合平均</span>
          <span className="font-bold text-slate-800">
            {totalAvg != null ? totalAvg.toFixed(2) : "—"}
          </span>
        </div>

        {/* 軸ごとのアコーディオン */}
        <div className="space-y-2">
          {EVALUATION_AXES.map((axis) => {
            const axisAvg = calcAxisAverage(scores, axis);
            const isOpen = expandedAxis === axis.id;
            return (
              <div key={axis.id} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setExpandedAxis(isOpen ? null : axis.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-700">{axis.label}</span>
                  <span className="text-sm text-slate-500">
                    {axisAvg != null ? axisAvg.toFixed(2) : "—"}
                    <span className="ml-2">{isOpen ? "▲" : "▼"}</span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-4">
                    {axis.subCategories.map((sc) => (
                      <div key={sc.id}>
                        <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {sc.id} {sc.label}
                        </p>
                        <div className="space-y-3">
                          {sc.items.map((item) => {
                            const current = scores[item.id] ?? null;
                            return (
                              <div key={item.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                                <span className="text-sm text-slate-600 sm:w-52 sm:shrink-0" title={item.label}>
                                  {item.id} {item.label}
                                </span>
                                <div className="flex gap-2">
                                  {GRADES.map((g) => (
                                    <button
                                      key={g}
                                      type="button"
                                      onClick={() => setGrade(item.id, g)}
                                      className={`h-12 w-12 rounded-lg text-base font-bold transition-colors ${
                                        current === g
                                          ? GRADE_COLORS[g]
                                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                      }`}
                                    >
                                      {g}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setGrade(item.id, null)}
                                    className={`h-12 w-12 rounded-lg text-base font-medium transition-colors border-2 ${
                                      current === null
                                        ? "bg-purple-600 text-white border-purple-600"
                                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    N/A
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* コメント */}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">コメント（任意）</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            placeholder="フィードバックや所感を記入..."
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
