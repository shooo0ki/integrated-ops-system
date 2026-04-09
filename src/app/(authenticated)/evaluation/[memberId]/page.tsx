"use client";

import { useState, use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  EVALUATION_AXES,
  GRADES,
  calcAxisAverage,
  calcTotalAverage,
  type EvalScores,
  type ScoreGrade,
} from "@/shared/constants/evaluation-taxonomy";
import type { EvalRow } from "@/shared/types/evaluation";
import { buildMonths } from "@/shared/utils";
import { ChevronLeft } from "lucide-react";

const GRADE_COLORS: Record<ScoreGrade, string> = {
  A: "bg-green-600 text-white",
  B: "bg-blue-600 text-white",
  C: "bg-slate-500 text-white",
  D: "bg-red-500 text-white",
};

const MONTHS = buildMonths(12);

export default function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month") ?? MONTHS[0];

  const { data: rows } = useSWR<EvalRow[]>(`/api/evaluations?month=${monthParam}`);
  const row = rows?.find((r) => r.memberId === memberId);

  const [scores, setScores] = useState<EvalScores>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // データ取得後に初期値をセット（render中setStateを避ける）
  useEffect(() => {
    if (!row) {
      setScores({});
      setComment("");
      return;
    }
    setScores(row.scores ?? {});
    setComment(row.comment ?? "");
  }, [row?.id, monthParam]);

  const totalAvg = calcTotalAverage(scores);

  function setGrade(itemId: string, grade: ScoreGrade | null) {
    setScores((prev) => ({ ...prev, [itemId]: grade }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          targetPeriod: monthParam,
          scores,
          comment: comment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "保存に失敗しました");
        return;
      }
      router.push(`/evaluation?month=${monthParam}`);
    } finally {
      setSaving(false);
    }
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft size={16} /> 戻る
        </button>
        <p className="text-slate-400">メンバーが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ヘッダー */}
      <div>
        <button
          onClick={() => router.push(`/evaluation?month=${monthParam}`)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ChevronLeft size={16} /> 評価一覧に戻る
        </button>
        <h1 className="text-xl font-bold text-slate-800">
          {row.memberName} の評価
        </h1>
        <p className="text-sm text-slate-500">対象月: {monthParam}</p>
      </div>

      {/* 総合スコア */}
      <div className="rounded-lg bg-slate-50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">総合平均</span>
        <span className="text-lg font-bold text-slate-800">
          {totalAvg != null ? totalAvg.toFixed(2) : "—"}
        </span>
      </div>

      {/* 軸ごとの評価フォーム（全展開） */}
      <div className="space-y-4">
        {EVALUATION_AXES.map((axis) => {
          const axisAvg = calcAxisAverage(scores, axis);
          return (
            <div key={axis.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-700">{axis.label}</span>
                <span className="text-sm font-medium text-slate-500">
                  {axisAvg != null ? axisAvg.toFixed(2) : "—"}
                </span>
              </div>
              <div className="px-5 py-4 space-y-5">
                {axis.subCategories.map((sc) => (
                  <div key={sc.id}>
                    <p className="mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {sc.id} {sc.label}
                    </p>
                    <div className="space-y-3">
                      {sc.items.map((item) => {
                        const current = scores[item.id] ?? null;
                        return (
                          <div key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <span className="text-sm text-slate-600 sm:w-56 sm:shrink-0">
                              {item.id} {item.label}
                            </span>
                            <div className="flex gap-2">
                              {GRADES.map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => setGrade(item.id, g)}
                                  className={`h-10 w-10 rounded-lg text-sm font-bold transition-colors ${
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
                                className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors border-2 ${
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
            </div>
          );
        })}
      </div>

      {/* コメント */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">コメント（任意）</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          placeholder="フィードバックや所感を記入..."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* アクションボタン */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button
          onClick={() => router.push(`/evaluation?month=${monthParam}`)}
          className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
