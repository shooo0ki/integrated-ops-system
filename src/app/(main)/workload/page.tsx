"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── 型定義 ──────────────────────────────────────────────

interface MemberRow { id: string; name: string; company: string }
interface ProjectCol { id: string; name: string; company: string; status: string }
interface CellData { assignId: string; hours: number }

interface WorkloadData {
  members: MemberRow[];
  projects: ProjectCol[];
  matrix: Record<string, Record<string, CellData>>;
}

// ─── ページ ───────────────────────────────────────────────

export default function WorkloadPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [cells, setCells] = useState<Record<string, Record<string, CellData>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/workload?month=${month}`)
      .then((r) => r.json())
      .then((d: WorkloadData) => {
        setData(d);
        setCells(d.matrix);
      })
      .finally(() => setLoading(false));
  }, [month]);

  function memberTotal(memberId: string): number {
    return Object.values(cells[memberId] ?? {}).reduce((s, c) => s + (c?.hours ?? 0), 0);
  }

  function projectTotal(projectId: string): number {
    return (data?.members ?? []).reduce((s, m) => s + (cells[m.id]?.[projectId]?.hours ?? 0), 0);
  }

  async function saveAll() {
    if (!data) return;
    setSaving(true);
    const patches: Promise<Response>[] = [];
    for (const [memberId, projs] of Object.entries(cells)) {
      for (const [, cell] of Object.entries(projs)) {
        const orig = data.matrix[memberId]?.[Object.keys(projs).find((pid) => projs[pid] === cell) ?? ""];
        if (orig && orig.hours !== cell.hours) {
          patches.push(
            fetch(`/api/projects/${Object.keys(projs).find((pid) => projs[pid] === cell)}/assignments/${cell.assignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workloadHours: cell.hours }),
            })
          );
        }
      }
    }
    // simpler: patch all changed cells
    const allPatches: Promise<Response>[] = [];
    for (const [memberId, projs] of Object.entries(cells)) {
      for (const [projectId, cell] of Object.entries(projs)) {
        const origHours = data.matrix[memberId]?.[projectId]?.hours;
        if (origHours !== undefined && origHours !== cell.hours) {
          allPatches.push(
            fetch(`/api/projects/${projectId}/assignments/${cell.assignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workloadHours: cell.hours }),
            })
          );
        }
      }
    }
    await Promise.all(allPatches);
    setSaving(false);
    setEditMode(false);
    // reload
    const d: WorkloadData = await fetch(`/api/workload?month=${month}`).then((r) => r.json());
    setData(d);
    setCells(d.matrix);
  }

  // generate month options (current + 5 months back)
  const monthOptions: string[] = [];
  const base = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    monthOptions.push(d.toISOString().slice(0, 7));
  }

  const members = data?.members ?? [];
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">工数管理</h1>
          <p className="text-sm text-slate-500">メンバー × プロジェクト 月間工数マトリクス</p>
        </div>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m.replace("-", "年")}月</option>
            ))}
          </select>
          {editMode ? (
            <Button variant="primary" size="sm" onClick={saveAll} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              編集モード
            </Button>
          )}
          {editMode && (
            <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setCells(data?.matrix ?? {}); }}>
              キャンセル
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[160px]">
                    メンバー
                  </th>
                  {projects.map((p) => (
                    <th key={p.id} className="px-3 py-3 text-center text-xs font-medium text-slate-600 min-w-[100px] border-r border-slate-100">
                      <Badge variant={p.company === "boost" ? "boost" : "salt2"} className="text-xs">
                        {p.company === "boost" ? "Boost" : "SALT2"}
                      </Badge>
                      <p className="mt-0.5 text-slate-700 font-semibold truncate max-w-[90px]">{p.name.slice(0, 10)}</p>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-700 bg-blue-50 min-w-[80px]">合計</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const total = memberTotal(m.id);
                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="sticky left-0 bg-white border-r border-slate-200 px-4 py-2.5">
                        <Link href={`/members/${m.id}`} className="font-medium text-slate-800 hover:text-blue-600">{m.name}</Link>
                      </td>
                      {projects.map((p) => {
                        const cell = cells[m.id]?.[p.id];
                        return (
                          <td key={p.id} className="px-3 py-2 text-center border-r border-slate-100">
                            {editMode && cell ? (
                              <input
                                type="number"
                                min={0}
                                value={cell.hours}
                                onChange={(e) =>
                                  setCells((prev) => ({
                                    ...prev,
                                    [m.id]: {
                                      ...prev[m.id],
                                      [p.id]: { ...cell, hours: Number(e.target.value) },
                                    },
                                  }))
                                }
                                className="w-16 rounded border border-blue-300 px-1 py-0.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            ) : cell ? (
                              <span className="font-medium text-slate-700">{cell.hours}h</span>
                            ) : (
                              <span className="text-slate-200">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={`px-3 py-2 text-center font-bold bg-blue-50 ${total > 160 ? "text-amber-600" : "text-slate-800"}`}>
                        {total}h
                        {total > 160 && <p className="text-xs text-amber-500">超過</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="sticky left-0 bg-slate-50 border-r border-slate-200 px-4 py-2.5 font-bold text-slate-700 text-sm">合計</td>
                  {projects.map((p) => (
                    <td key={p.id} className="px-3 py-2.5 text-center font-bold text-slate-800 border-r border-slate-100">
                      {projectTotal(p.id)}h
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center font-bold text-blue-700 bg-blue-100">
                    {members.reduce((s, m) => s + memberTotal(m.id), 0)}h
                  </td>
                </tr>
              </tfoot>
            </table>
            {members.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">
                アクティブなアサインがありません
              </div>
            )}
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-400 text-right">※ 160h/月以上でオレンジ表示（過負荷警告）</p>
    </div>
  );
}
