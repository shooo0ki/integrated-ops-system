"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/frontend/contexts/auth-context";
import { formatCurrency } from "@/shared/utils";

interface DashboardData {
  today: string;
  teamAttendance?: { working: number; done: number; total: number };
  plSummary?: { boost: { revenue: number; profit: number }; salt2: { revenue: number; profit: number } };
  notStartedCount?: number;
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

  if (authLoading || role === "member") return null;

  const team = data?.teamAttendance;
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
            {team && (
              <>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">本日の出勤</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {team.working + team.done} / {team.total}名
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">勤務中</td>
                  <td className="px-4 py-2.5 text-right font-medium text-blue-600">{team.working}名</td>
                </tr>
              </>
            )}
            {data?.notStartedCount !== undefined && data.notStartedCount > 0 && (
              <tr>
                <td className="px-4 py-2.5 text-slate-700">未出勤</td>
                <td className="px-4 py-2.5 text-right font-medium text-orange-600">{data.notStartedCount}名</td>
              </tr>
            )}
            {pl && (
              <>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">Boost 売上 / 利益</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {formatCurrency(pl.boost.revenue)} / {formatCurrency(pl.boost.profit)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700">SALT2 売上 / 利益</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {formatCurrency(pl.salt2.revenue)} / {formatCurrency(pl.salt2.profit)}
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
