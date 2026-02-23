"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FolderOpen, Users, Calendar, ArrowRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

interface Assignment {
  id: string;
  memberId: string;
  memberName: string;
  positionName: string;
  workloadHours: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  company: string;
  startDate: string;
  endDate: string | null;
  clientName: string | null;
  contractType: string | null;
  monthlyContractAmount: number;
  assignments: Assignment[];
}

// ─── スタイル・ユーティリティ ─────────────────────────────

const statusColor: Record<string, "success" | "default" | "warning"> = {
  active: "success",
  completed: "default",
  on_hold: "warning",
  planning: "warning",
};

const STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  completed: "完了",
  on_hold: "一時停止",
  planning: "計画中",
};

const companyDisplay = (c: string) => (c === "boost" ? "Boost" : "SALT2");

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}

function formatCurrency(n: number): string {
  return n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });
}

// ─── ページ ───────────────────────────────────────────────

export default function ProjectsPage() {
  const { role } = useAuth();
  const canCreate = role === "admin" || role === "manager";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (companyFilter) params.set("company", companyFilter);
    if (statusFilter) params.set("status", statusFilter);
    setLoading(true);
    fetch(`/api/projects?${params}`)
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [companyFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">プロジェクト一覧</h1>
          <p className="text-sm text-slate-500">{projects.length}件</p>
        </div>
        {canCreate && (
          <Link href="/projects/new" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={15} /> 新規登録
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">全ステータス</option>
          <option value="active">進行中</option>
          <option value="planning">計画中</option>
          <option value="completed">完了</option>
          <option value="on_hold">一時停止</option>
        </select>
      </div>

      {/* Project cards */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <FolderOpen size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-800">{project.name}</h2>
                      <Badge variant={project.company === "boost" ? "boost" : "salt2"}>
                        {companyDisplay(project.company)}
                      </Badge>
                      <Badge variant={statusColor[project.status] ?? "default"}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </div>
                    {project.description && (
                      <p className="mt-2 text-sm text-slate-600">{project.description}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400">月額契約</p>
                  <p className="text-base font-bold text-slate-800">{formatCurrency(project.monthlyContractAmount)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={13} />
                  開始: {formatDate(project.startDate)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users size={13} />
                  {project.assignments.length}名アサイン
                </div>
                {project.clientName && (
                  <div className="text-xs text-slate-500">クライアント: {project.clientName}</div>
                )}
              </div>

              {project.assignments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500">アサインメンバー</p>
                  <div className="flex flex-wrap gap-2">
                    {project.assignments.map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs">
                        <Link href={`/members/${a.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">
                          {a.memberName}
                        </Link>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">{a.positionName}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-blue-600">{a.workloadHours}h/月</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                  詳細を見る <ArrowRight size={13} />
                </Link>
              </div>
            </Card>
          ))}

          {projects.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              <FolderOpen size={32} className="mx-auto mb-2 text-slate-300" />
              <p>該当するプロジェクトがありません</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
