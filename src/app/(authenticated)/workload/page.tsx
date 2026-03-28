"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import Link from "@/frontend/components/common/prefetch-link";
import { Select } from "@/frontend/components/common/input";
import { Card } from "@/frontend/components/common/card";
import { Button } from "@/frontend/components/common/button";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";

// ─── 型定義 ──────────────────────────────────────────────

interface MemberRow { id: string; name: string }
interface ProjectCol { id: string; name: string; status: string }
interface CellData { assignId: string; hours: number }

interface WorkloadData {
  members: MemberRow[];
  projects: ProjectCol[];
  matrix?: Record<string, Record<string, CellData>>;
  periodMatrix?: Record<string, Record<string, Record<string, number>>>;
  months: string[];
}

type ViewMode = "monthly" | "period";

function isConfirmed(status: string): boolean {
  return status === "active" || status === "completed";
}

// ─── ページ ───────────────────────────────────────────────

export default function WorkloadPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [month, setMonth] = useState("");
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  // 編集モード（単月のみ）
  const [editMode, setEditMode] = useState(false);
  const [cells, setCells] = useState<Record<string, Record<string, CellData>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const now = new Date();
    const opts: string[] = [];
    for (let i = -6; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    setMonthOptions(opts);
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(cur);
    // 期間ビューのデフォルト: 当月〜6ヶ月後
    setPeriodFrom(cur);
    const half = new Date(now.getFullYear(), now.getMonth() + 5, 1);
    setPeriodTo(`${half.getFullYear()}-${String(half.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  const swrKey = useMemo(() => {
    if (viewMode === "monthly" && month) return `/api/workload?month=${month}`;
    if (viewMode === "period" && periodFrom && periodTo) return `/api/workload?from=${periodFrom}&to=${periodTo}`;
    return null;
  }, [viewMode, month, periodFrom, periodTo]);

  const { data, isLoading: loading, mutate } = useSWR<WorkloadData>(swrKey);

  useEffect(() => {
    if (data?.matrix) setCells(data.matrix);
  }, [data]);

  const members = data?.members ?? [];
  const projects = data?.projects ?? [];
  const months = data?.months ?? [];

  function memberTotal(memberId: string): number {
    return Object.values(cells[memberId] ?? {}).reduce((s, c) => s + (c?.hours ?? 0), 0);
  }

  function projectTotal(projectId: string): number {
    return members.reduce((s, m) => s + (cells[m.id]?.[projectId]?.hours ?? 0), 0);
  }

  async function saveAll() {
    if (!data?.matrix) return;
    setSaving(true);
    const patches: Promise<Response>[] = [];
    for (const [memberId, projs] of Object.entries(cells)) {
      for (const [projectId, cell] of Object.entries(projs)) {
        const origHours = data.matrix[memberId]?.[projectId]?.hours;
        if (origHours !== undefined && origHours !== cell.hours) {
          patches.push(
            fetch(`/api/projects/${projectId}/assignments/${cell.assignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workloadHours: cell.hours }),
            })
          );
        }
      }
    }
    await Promise.all(patches);
    setSaving(false);
    setEditMode(false);
    await mutate();
  }

  // プロジェクト名の表示
  function projectLabel(p: ProjectCol) {
    if (isConfirmed(p.status)) {
      return <span className="font-semibold text-slate-700 truncate max-w-[90px]">{p.name.slice(0, 10)}</span>;
    }
    return <span className="font-normal text-slate-400 truncate max-w-[90px]">({p.name.slice(0, 10)})</span>;
  }

  // 期間ビューのセル値
  function periodHours(memberId: string, projectId: string, m: string): number | null {
    return data?.periodMatrix?.[memberId]?.[projectId]?.[m] ?? null;
  }

  // 期間ビューのメンバー月合計
  function memberMonthTotal(memberId: string, m: string): number {
    return projects.reduce((s, p) => s + (periodHours(memberId, p.id, m) ?? 0), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">工数管理</h1>
          <p className="text-sm text-slate-500">メンバー × プロジェクト 月間工数マトリクス</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* ビュー切替 */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => { setViewMode("monthly"); setEditMode(false); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "monthly" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              単月
            </button>
            <button
              onClick={() => { setViewMode("period"); setEditMode(false); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "period" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              期間
            </button>
          </div>

          {viewMode === "monthly" ? (
            <>
              <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m.replace("-", "年")}月</option>
                ))}
              </Select>
              {editMode ? (
                <>
                  <Button variant="primary" size="sm" onClick={saveAll} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setCells(data?.matrix ?? {}); }}>
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  編集モード
                </Button>
              )}
            </>
          ) : (
            <>
              <Select value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)}>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m.replace("-", "年")}月〜</option>
                ))}
              </Select>
              <Select value={periodTo} onChange={(e) => setPeriodTo(e.target.value)}>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m.replace("-", "年")}月</option>
                ))}
              </Select>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <InlineSkeleton />
      ) : viewMode === "monthly" ? (
        /* ─── 単月ビュー ─── */
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[160px]">
                    メンバー
                  </th>
                  {projects.map((p) => (
                    <th key={p.id} className="px-3 py-3 text-center text-xs min-w-[100px] border-r border-slate-100">
                      {projectLabel(p)}
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
                        const confirmed = isConfirmed(p.status);
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
                              confirmed ? (
                                <span className="font-medium text-slate-700">{cell.hours}h</span>
                              ) : (
                                <span className="text-slate-400">({cell.hours}h)</span>
                              )
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
              <div className="py-12 text-center text-sm text-slate-400">アクティブなアサインがありません</div>
            )}
          </div>
        </Card>
      ) : (
        /* ─── 期間ビュー ─── */
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[120px]">
                    メンバー
                  </th>
                  <th className="sticky left-[120px] z-10 bg-slate-50 border-r border-slate-200 px-3 py-3 text-left text-xs font-semibold text-slate-600 min-w-[110px]">
                    プロジェクト
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-3 py-3 text-center text-xs font-medium text-slate-600 min-w-[70px] border-r border-slate-100">
                      {m.slice(2).replace("-", "/")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  // このメンバーに関連するプロジェクト
                  const memberProjects = projects.filter(
                    (p) => data?.periodMatrix?.[member.id]?.[p.id]
                  );
                  if (memberProjects.length === 0) return null;

                  return memberProjects.map((p, pi) => {
                    const confirmed = isConfirmed(p.status);
                    return (
                      <tr key={`${member.id}-${p.id}`} className={`border-b border-slate-100 hover:bg-slate-50 ${
                        pi === 0 ? "border-t border-slate-200" : ""
                      }`}>
                        {pi === 0 && (
                          <td
                            className="sticky left-0 bg-white border-r border-slate-200 px-4 py-2 align-top"
                            rowSpan={memberProjects.length}
                          >
                            <Link href={`/members/${member.id}`} className="font-medium text-slate-800 hover:text-blue-600 text-xs">
                              {member.name}
                            </Link>
                          </td>
                        )}
                        <td className="sticky left-[120px] bg-white border-r border-slate-200 px-3 py-2">
                          {confirmed ? (
                            <span className="text-xs font-medium text-slate-700 truncate block max-w-[100px]">{p.name.slice(0, 12)}</span>
                          ) : (
                            <span className="text-xs text-slate-400 truncate block max-w-[100px]">({p.name.slice(0, 12)})</span>
                          )}
                        </td>
                        {months.map((m) => {
                          const hours = periodHours(member.id, p.id, m);
                          return (
                            <td key={m} className="px-2 py-2 text-center border-r border-slate-100 text-xs">
                              {hours != null ? (
                                confirmed ? (
                                  <span className="font-medium text-slate-700">{hours}</span>
                                ) : (
                                  <span className="text-slate-400">({hours})</span>
                                )
                              ) : (
                                <span className="text-slate-200">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
              {/* メンバー月合計 */}
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-slate-200">
                  <td className="sticky left-0 bg-blue-50 border-r border-slate-200 px-4 py-2.5 font-bold text-slate-700 text-xs" colSpan={2}>
                    月合計
                  </td>
                  {months.map((m) => {
                    const total = members.reduce((s, mb) => s + memberMonthTotal(mb.id, m), 0);
                    return (
                      <td key={m} className="px-2 py-2.5 text-center font-bold text-blue-700 text-xs border-r border-slate-100">
                        {total}h
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
            {members.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">アクティブなアサインがありません</div>
            )}
          </div>
        </Card>
      )}

      <div className="flex justify-between text-xs text-slate-400">
        <p>※ 確定PJ = 黒字、未確定PJ = (かっこ書き薄字)</p>
        <p>※ 160h/月以上でオレンジ表示（過負荷警告）</p>
      </div>
    </div>
  );
}
