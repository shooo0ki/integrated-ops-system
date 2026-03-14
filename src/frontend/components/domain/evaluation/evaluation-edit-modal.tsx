"use client";

import { useState } from "react";

import type { EvalRow } from "@/shared/types/evaluation";
import { SCORE_LABELS } from "@/frontend/constants/evaluation";

export type ModalState = {
  memberId: string;
  memberName: string;
  targetPeriod: string;
  scoreP: number;
  scoreA: number;
  scoreS: number;
  comment: string;
};

export function EditModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ModalState;
  onClose: () => void;
  onSaved: (row: EvalRow) => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalAvg = Math.round(((form.scoreP + form.scoreA + form.scoreS) / 3) * 100) / 100;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: form.memberId,
          targetPeriod: form.targetPeriod,
          scoreP: form.scoreP,
          scoreA: form.scoreA,
          scoreS: form.scoreS,
          comment: form.comment || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "保存に失敗しました");
        return;
      }
      onSaved({
        memberId: form.memberId,
        memberName: initial.memberName,
        evaluated: true,
        id: data.id,
        targetPeriod: data.targetPeriod,
        scoreP: data.scoreP, labelP: SCORE_LABELS[data.scoreP],
        scoreA: data.scoreA, labelA: SCORE_LABELS[data.scoreA],
        scoreS: data.scoreS, labelS: SCORE_LABELS[data.scoreS],
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
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-slate-800">人事評価 — {initial.memberName}</h2>
        <p className="mb-4 text-sm text-slate-500">対象月: {form.targetPeriod}</p>

        {(["P", "A", "S"] as const).map((key) => {
          const labels = { P: "Professional（仕事の質・責任感）", A: "Appearance（身だしなみ・礼儀）", S: "Skill（技術・専門知識）" };
          const field = `score${key}` as "scoreP" | "scoreA" | "scoreS";
          return (
            <div key={key} className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{labels[key]}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setForm((f) => ({ ...f, [field]: v }))}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      form[field] === v
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
                <span className="ml-2 self-center text-sm text-slate-500">{SCORE_LABELS[form[field]]}</span>
              </div>
            </div>
          );
        })}

        <div className="mb-2 rounded-lg bg-slate-50 px-4 py-2 text-sm">
          <span className="text-slate-500">総合平均:</span>
          <span className="ml-2 font-bold text-slate-800">{totalAvg.toFixed(2)}</span>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">コメント（任意）</label>
          <textarea
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            placeholder="フィードバックや所感を記入..."
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
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
