"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock, Users, FolderOpen, FileText, TrendingUp,
  AlertTriangle, CheckCircle, Circle, Coffee, ArrowRight
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── 型定義 ──────────────────────────────────────────────

type AttendanceStatus = "not_started" | "working" | "break" | "done";

interface DashboardData {
  today: string;
  myAttendance: {
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    workMinutes: number | null;
    todoToday: string | null;
    status: AttendanceStatus;
  } | null;
  myProjects: Array<{
    assignId: string;
    projectId: string;
    projectName: string;
    company: string;
    status: string;
    positionName: string;
    workloadHours: number;
  }>;
  teamAttendance: Array<{
    memberId: string;
    memberName: string;
    status: string;
    clockIn: string | null;
    clockOut: string | null;
  }>;
  plSummary: {
    totalRevenue: number;
    totalGrossProfit: number;
    boostRevenue: number;
    salt2Revenue: number;
    boostGrossProfit: number;
    salt2GrossProfit: number;
  } | null;
  notStartedCount: number | null;
}

// ─── スタイル ────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  working: "出勤中", break: "休憩中", done: "退勤済", not_started: "未出勤", absent: "欠勤",
};

const statusIcon: Record<string, React.ReactNode> = {
  working: <CheckCircle size={14} className="text-green-500" />,
  break: <Coffee size={14} className="text-amber-500" />,
  done: <CheckCircle size={14} className="text-slate-400" />,
  not_started: <Circle size={14} className="text-slate-300" />,
  absent: <AlertTriangle size={14} className="text-red-400" />,
};

const statusVariant: Record<string, "success" | "warning" | "default" | "danger"> = {
  working: "success", break: "warning", done: "default", not_started: "default",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}

// ─── ページ ───────────────────────────────────────────────

export default function DashboardPage() {
  const { role } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ダッシュボード</h1>
          <p className="text-sm text-slate-500">{todayLabel}</p>
        </div>
        <div className="py-12 text-center text-sm text-slate-400">読み込み中...</div>
      </div>
    );
  }

  const myStatus = data?.myAttendance?.status ?? "not_started";
  const isAdmin = role === "admin" || role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ダッシュボード</h1>
        <p className="text-sm text-slate-500">{todayLabel}</p>
      </div>

      {/* アラート（admin/manager: 未打刻メンバー） */}
      {isAdmin && (data?.notStartedCount ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            本日まだ打刻していないメンバーが
            <span className="font-semibold"> {data!.notStartedCount}名 </span>
            います。
          </p>
          <Link href="/attendance/list" className="ml-auto text-xs font-medium text-amber-700 underline">
            勤怠一覧を確認
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 今日の勤怠 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>今日の勤怠</CardTitle>
            <Clock size={16} className="text-slate-400" />
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">ステータス</span>
              <Badge variant={statusVariant[myStatus] ?? "default"} className="flex items-center gap-1">
                {statusIcon[myStatus]}
                {STATUS_LABELS[myStatus] ?? myStatus}
              </Badge>
            </div>
            {data?.myAttendance?.clockIn && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">出勤時刻</span>
                <span className="text-sm font-medium text-slate-800">{data.myAttendance.clockIn}</span>
              </div>
            )}
            {data?.myAttendance?.clockOut && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">退勤時刻</span>
                <span className="text-sm font-medium text-slate-800">{data.myAttendance.clockOut}</span>
              </div>
            )}
            {data?.myAttendance?.workMinutes != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">実働時間</span>
                <span className="text-sm font-medium text-slate-800">
                  {(data.myAttendance.workMinutes / 60).toFixed(1)}h
                </span>
              </div>
            )}
            <Link href="/attendance">
              <Button variant="outline" size="sm" className="mt-2 w-full">
                打刻画面へ
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </Card>

        {/* 担当プロジェクト */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>担当プロジェクト</CardTitle>
            <FolderOpen size={16} className="text-slate-400" />
          </CardHeader>
          {!data?.myProjects.length ? (
            <p className="text-sm text-slate-500">担当プロジェクトはありません。</p>
          ) : (
            <div className="space-y-3">
              {data.myProjects.map((pj) => (
                <div
                  key={pj.assignId}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={pj.company === "boost" ? "boost" : "salt2"}>
                        {pj.company === "boost" ? "Boost" : "SALT2"}
                      </Badge>
                      <span className="truncate text-sm font-medium text-slate-800">{pj.projectName}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      役割: {pj.positionName} | 稼働: {pj.workloadHours}h/月
                    </p>
                  </div>
                  <Link href={`/projects/${pj.projectId}`} className="shrink-0 text-xs text-blue-600 hover:underline ml-2">
                    詳細
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* チーム在席状況 + 管理者サマリー */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* チーム在席（admin/manager） */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>チーム在席状況</CardTitle>
              <Users size={16} className="text-slate-400" />
            </CardHeader>
            <div className="space-y-2">
              {data?.teamAttendance.map((rec) => (
                <div key={rec.memberId} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    {statusIcon[rec.status]}
                    <span className="text-sm font-medium text-slate-700">{rec.memberName}</span>
                  </div>
                  <span className="text-xs text-slate-500">{STATUS_LABELS[rec.status] ?? rec.status}</span>
                </div>
              ))}
              {!data?.teamAttendance.length && (
                <p className="text-sm text-slate-400">データがありません</p>
              )}
            </div>
          </Card>
        )}

        {/* 管理者 PL サマリー */}
        {role === "admin" && data?.plSummary && (
          <Card>
            <CardHeader>
              <CardTitle>当月サマリー</CardTitle>
              <TrendingUp size={16} className="text-slate-400" />
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">売上合計</span>
                <span className="text-base font-bold text-slate-800">
                  {formatCurrency(data.plSummary.totalRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                <span className="text-sm text-green-700">粗利合計</span>
                <span className="text-base font-bold text-green-800">
                  {formatCurrency(data.plSummary.totalGrossProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
                <span className="text-sm text-blue-700">Boost 売上</span>
                <span className="text-base font-bold text-blue-800">
                  {formatCurrency(data.plSummary.boostRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                <span className="text-sm text-green-700">SALT2 売上</span>
                <span className="text-base font-bold text-green-800">
                  {formatCurrency(data.plSummary.salt2Revenue)}
                </span>
              </div>
              <Link href="/pl/summary">
                <Button variant="outline" size="sm" className="mt-2 w-full">
                  PL詳細を見る <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* クイックリンク */}
        <Card>
          <CardHeader>
            <CardTitle>クイックリンク</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/attendance", label: "打刻画面", icon: Clock },
              { href: "/members", label: "メンバー一覧", icon: Users },
              { href: "/projects", label: "プロジェクト", icon: FolderOpen },
              { href: "/invoices", label: "請求書", icon: FileText },
            ]
              .filter((item) => {
                if (item.href === "/members" && !["admin", "manager"].includes(role)) return false;
                if (item.href === "/invoices" && role !== "admin") return false;
                return true;
              })
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
