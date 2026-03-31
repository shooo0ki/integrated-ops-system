"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { SelfReportCard } from "@/frontend/components/domain/closing/self-report-card";
import { Select } from "@/frontend/components/common/input";
import { Card, CardHeader, CardTitle } from "@/frontend/components/common/card";
import { Badge } from "@/frontend/components/common/badge";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";
import type { MyProject } from "@/shared/types/closing";

interface SelfReportSummary {
  memberId: string;
  memberName: string;
  submitted: boolean;
  totalPercent: number;
  submittedAt: string | null;
  projects: { projectId: string | null; projectName: string | null; customLabel: string | null; reportedPercent: number }[];
}

function buildMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

const MONTHS = buildMonths(6);

export default function SelfReportsPage() {
  const { role, isLoading: authLoading } = useAuth();
  const isAdmin = role === "admin" || role === "manager";
  const [month, setMonth] = useState(MONTHS[0]);

  // 管理者用：全メンバーの申告状況
  const { data: allReports, isLoading: reportsLoading } = useSWR<SelfReportSummary[]>(
    isAdmin ? `/api/self-reports?month=${month}` : null
  );

  // メンバー用：自分の担当PJ
  const { data: myProjectsRaw } = useSWR<{ projectId: string; projectName: string }[]>(
    !isAdmin ? "/api/mypage-summary" : null,
    {
      revalidateOnFocus: false,
    }
  );

  const myProjects: MyProject[] = useMemo(() => {
    if (!myProjectsRaw) return [];
    if (Array.isArray(myProjectsRaw)) return myProjectsRaw;
    // mypage-summary returns { member: { projects: [...] } }
    const raw = myProjectsRaw as unknown as { member?: { projects?: MyProject[] } };
    return raw?.member?.projects ?? [];
  }, [myProjectsRaw]);

  const stats = useMemo(() => {
    if (!allReports) return null;
    const total = allReports.length;
    const submitted = allReports.filter((r) => r.submitted).length;
    return { total, submitted, pending: total - submitted };
  }, [allReports]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">月次工数自己申告</h1>
          <p className="text-sm text-slate-500">プロジェクトごとの工数配分を申告</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">月:</label>
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m.replace("-", "年")}月</option>
            ))}
          </Select>
        </div>
      </div>

      {/* 管理者: 全メンバーの申告状況 */}
      {isAdmin && (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <p className="text-xs text-slate-500">総メンバー</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{stats.total}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate-500">申告済み</p>
                <p className="mt-1 text-2xl font-bold text-green-600">{stats.submitted}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate-500">未申告</p>
                <p className="mt-1 text-2xl font-bold text-orange-600">{stats.pending}</p>
              </Card>
            </div>
          )}

          {reportsLoading ? (
            <InlineSkeleton />
          ) : (
            <Card noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr className="text-xs text-slate-500">
                      <th className="px-4 py-3 text-left font-medium">メンバー</th>
                      <th className="px-4 py-3 text-center font-medium">ステータス</th>
                      <th className="px-4 py-3 text-right font-medium">合計%</th>
                      <th className="px-4 py-3 text-left font-medium">内訳</th>
                      <th className="px-4 py-3 text-left font-medium">申告日時</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allReports?.map((r) => (
                      <tr key={r.memberId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-700">{r.memberName}</td>
                        <td className="px-4 py-2.5 text-center">
                          {r.submitted ? (
                            <Badge variant="success">申告済</Badge>
                          ) : (
                            <Badge variant="warning">未申告</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                          {r.submitted ? `${r.totalPercent}%` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[300px]">
                          {r.submitted
                            ? r.projects.map((p) => `${p.projectName ?? p.customLabel}(${p.reportedPercent}%)`).join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-400">
                          {r.submittedAt
                            ? new Date(r.submittedAt).toLocaleString("ja-JP")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allReports?.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">メンバーが見つかりません</p>
              )}
            </Card>
          )}
        </>
      )}

      {/* メンバー: 自分の申告フォーム */}
      {!isAdmin && !authLoading && (
        <SelfReportCard month={month} myProjects={myProjects} />
      )}
    </div>
  );
}
