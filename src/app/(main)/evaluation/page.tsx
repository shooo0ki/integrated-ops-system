"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { buildMonths } from "@/lib/utils";

// ---- 型定義 ----
type EvalRow = {
  memberId: string;
  memberName: string;
  evaluated: boolean;
  id?: string;
  targetPeriod?: string;
  scoreP?: number; labelP?: string;
  scoreA?: number; labelA?: string;
  scoreS?: number; labelS?: string;
  totalAvg?: number;
  comment?: string;
  updatedAt?: string;
};

type OwnEval = {
  id: string;
  memberId: string;
  targetPeriod: string;
  scoreP: number; labelP: string;
  scoreA: number; labelA: string;
  scoreS: number; labelS: string;
  totalAvg: number;
  comment?: string;
  updatedAt: string;
} | null;

const SCORE_LABELS = ["", "要改善", "普通以下", "標準", "優秀", "卓越"];
const MONTHS = buildMonths(12);

function StarBar({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= score ? "text-amber-400" : "text-slate-200"}>★</span>
      ))}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const colors = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-slate-100 text-slate-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${colors[score] ?? ""}`}>
      {score}点 {label}
    </span>
  );
}

// ---- 編集モーダル ----
type ModalState = {
  memberId: string;
  memberName: string;
  targetPeriod: string;
  scoreP: number;
  scoreA: number;
  scoreS: number;
  comment: string;
};

function EditModal({
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

// ---- メインページ ----
export default function EvaluationPage() {
  const { role, memberId } = useAuth();
  const [month, setMonth] = useState(MONTHS[0]);
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [ownEval, setOwnEval] = useState<OwnEval>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canEdit = isAdmin;

  // 管理者・マネージャー: 全員一覧
  const loadRows = useCallback(async () => {
    if (!isAdmin && !isManager) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluations?month=${month}`);
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isManager, month]);

  // 一般ユーザー: 自分のみ
  const loadOwn = useCallback(async () => {
    if (isAdmin || isManager || !memberId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluations?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setOwnEval(data);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isManager, memberId, month]);

  useEffect(() => {
    loadRows();
    loadOwn();
  }, [loadRows, loadOwn]);

  // Hooks must be called before early returns
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

  function handleSaved(updated: EvalRow) {
    setRows((prev) =>
      prev.map((r) =>
        r.memberId === updated.memberId
          ? { ...r, ...updated }
          : r
      )
    );
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
      {/* ヘッダー */}
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

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "総メンバー", value: rows.length },
          { label: "評価済み", value: rows.filter((r) => r.evaluated).length },
          {
            label: "未評価",
            value: rows.filter((r) => !r.evaluated).length,
          },
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
