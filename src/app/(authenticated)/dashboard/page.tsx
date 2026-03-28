"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { formatCurrency } from "@/shared/utils";

interface TeamMember {
  memberId: string;
  memberName: string;
  status: string;
  clockIn: string | null;
  clockOut: string | null;
}

interface PLSummary {
  totalRevenue: number;
  totalGrossProfit: number;
  boostRevenue: number;
  salt2Revenue: number;
  boostGrossProfit: number;
  salt2GrossProfit: number;
}

interface DashboardData {
  today: string;
  teamAttendance?: TeamMember[];
  plSummary?: PLSummary | null;
  notStartedCount?: number | null;
}

export default function DashboardPage() {
  const { role, name, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && role === "member") {
      router.replace("/mypage");
    }
  }, [authLoading, role, router]);

  const { data } = useSWR<DashboardData>(
    !authLoading && role !== "member" ? "/api/dashboard" : null
  );

  const teamStats = useMemo(() => {
    if (!data?.teamAttendance) return null;
    const working = data.teamAttendance.filter((m) => m.status === "working").length;
    const done = data.teamAttendance.filter((m) => m.status === "done").length;
    return { working, done, total: data.teamAttendance.length };
  }, [data?.teamAttendance]);

  if (authLoading || role === "member") return null;

  const pl = data?.plSummary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ダッシュボード</h1>
        <p className="text-sm text-slate-500">{name}さん、お疲れ様です</p>
      </div>

      {/* KPI テーブル */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">項目</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-500">値</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {teamStats && (
              <>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">本日の出勤</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {teamStats.working + teamStats.done} / {teamStats.total}名
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">勤務中</td>
                  <td className="px-4 py-2.5 text-right font-medium text-blue-600">{teamStats.working}名</td>
                </tr>
              </>
            )}
            {data?.notStartedCount != null && data.notStartedCount > 0 && (
              <tr>
                <td className="px-4 py-2.5 text-slate-700">未出勤</td>
                <td className="px-4 py-2.5 text-right font-medium text-orange-600">{data.notStartedCount}名</td>
              </tr>
            )}
            {pl && (
              <>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">Boost 売上 / 粗利</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {formatCurrency(pl.boostRevenue)} / {formatCurrency(pl.boostGrossProfit)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">SALT2 売上 / 粗利</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {formatCurrency(pl.salt2Revenue)} / {formatCurrency(pl.salt2GrossProfit)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
