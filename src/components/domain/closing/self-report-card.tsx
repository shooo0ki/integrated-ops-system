"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { CheckCircle, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/common/card";
import { Button } from "@/components/common/button";

import type { MyProject, SelfReportRow, SelfReportItem } from "@/types/closing";
import { NON_PROJECT_OPTIONS } from "@/constants/closing";

export function SelfReportCard({
  month,
  myProjects,
}: {
  month: string;
  myProjects: MyProject[];
}) {
  const { data: selfReports, mutate: mutateSR } = useSWR<SelfReportItem[]>(
    month ? `/api/self-reports?month=${month}` : null
  );
  const { data: allProjectsRaw } = useSWR<{ id: string; name: string }[]>(
    "/api/projects"
  );
  const allProjects = allProjectsRaw ?? [];

  const [rows, setRows] = useState<SelfReportRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitted = selfReports && selfReports.length > 0 && selfReports.every((r) => r.submittedAt);

  useEffect(() => {
    if (!selfReports) return;
    if (selfReports.length > 0) {
      if (!editing) {
        setRows(
          selfReports.map((r) => ({
            key: r.id,
            projectId: r.projectId,
            customLabel: r.customLabel,
            displayName: r.projectName ?? r.customLabel ?? "—",
            reportedPercent: r.reportedPercent,
          }))
        );
      }
    } else {
      setRows(
        myProjects.map((p) => ({
          key: p.projectId,
          projectId: p.projectId,
          customLabel: null,
          displayName: p.projectName,
          reportedPercent: 0,
        }))
      );
      setEditing(true);
    }
  }, [selfReports, myProjects, editing]);

  // 月が変わったら編集モードをリセット
  useEffect(() => {
    setEditing(false);
  }, [month]);

  const totalPercent = rows.reduce((s, r) => s + r.reportedPercent, 0);
  const isValid = totalPercent === 100;

  // 既に選択済みの projectId / customLabel
  const usedProjectIds = new Set(rows.map((r) => r.projectId).filter(Boolean));
  const usedCustomLabels = new Set(rows.map((r) => r.customLabel).filter(Boolean));

  function updatePercent(key: string, value: number) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, reportedPercent: value } : r));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function handleSelectChange(key: string, value: string) {
    if (!value) return;
    // value format: "project:<id>" or "custom:<label>"
    if (value.startsWith("project:")) {
      const projectId = value.slice(8);
      const pj = allProjects.find((p) => p.id === projectId);
      setRows((prev) => prev.map((r) =>
        r.key === key ? { ...r, projectId, customLabel: null, displayName: pj?.name ?? projectId } : r
      ));
    } else if (value.startsWith("custom:")) {
      const label = value.slice(7);
      setRows((prev) => prev.map((r) =>
        r.key === key ? { ...r, projectId: null, customLabel: label, displayName: label } : r
      ));
    }
  }

  function addRow() {
    const key = `new-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      { key, projectId: null, customLabel: null, displayName: "", reportedPercent: 0 },
    ]);
  }

  // 行の選択肢を構築（その行自身の選択は除外しない）
  function getSelectValue(row: SelfReportRow): string {
    if (row.projectId) return `project:${row.projectId}`;
    if (row.customLabel) return `custom:${row.customLabel}`;
    return "";
  }

  async function handleSubmit() {
    // 未選択の行がないかチェック
    const emptyRow = rows.find((r) => !r.projectId && !r.customLabel);
    if (emptyRow) {
      setError("項目が未選択の行があります");
      return;
    }
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/self-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMonth: month,
        allocations: rows.map((r) => ({
          projectId: r.projectId || undefined,
          customLabel: r.customLabel || undefined,
          reportedPercent: r.reportedPercent,
        })),
      }),
    });
    if (res.ok) {
      await mutateSR();
      setEditing(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message ?? "申告に失敗しました");
    }
    setSubmitting(false);
  }

  if (!month) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>月次工数自己申告</CardTitle>
          {submitted && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>修正する</Button>
          )}
        </div>
      </CardHeader>

      {submitted && !editing ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
            <CheckCircle size={15} className="text-green-600" />
            <span className="text-sm text-green-700 font-medium">申告済み</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs text-slate-500">
                <th className="py-2 text-left font-medium">項目</th>
                <th className="py-2 text-right font-medium">配分</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{r.displayName}</td>
                  <td className="py-2 text-right font-medium text-slate-800">{r.reportedPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 text-right">合計: {totalPercent}%</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            各プロジェクトの工数配分を%で入力してください（合計100%）
          </p>

          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs text-slate-500">
                <th className="py-2 text-left font-medium">項目</th>
                <th className="py-2 text-right font-medium w-24">配分(%)</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-slate-50">
                  <td className="py-2">
                    <select
                      value={getSelectValue(r)}
                      onChange={(e) => handleSelectChange(r.key, e.target.value)}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">選択してください</option>
                      <optgroup label="プロジェクト">
                        {allProjects.map((p) => (
                          <option
                            key={p.id}
                            value={`project:${p.id}`}
                            disabled={usedProjectIds.has(p.id) && r.projectId !== p.id}
                          >
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="プロジェクト外">
                        {NON_PROJECT_OPTIONS.map((label) => (
                          <option
                            key={label}
                            value={`custom:${label}`}
                            disabled={usedCustomLabels.has(label) && r.customLabel !== label}
                          >
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={r.reportedPercent}
                      onChange={(e) => updatePercent(r.key, Number(e.target.value) || 0)}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <button
                      onClick={() => removeRow(r.key)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addRow}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={14} /> 行を追加
          </button>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-slate-600">
              合計: <span className={`font-bold ${isValid ? "text-green-600" : "text-red-600"}`}>{totalPercent}%</span>
              {!isValid && <span className="ml-2 text-xs text-red-500">（100%にしてください）</span>}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !isValid || rows.length === 0}
            >
              {submitting ? "送信中..." : "申告する"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
