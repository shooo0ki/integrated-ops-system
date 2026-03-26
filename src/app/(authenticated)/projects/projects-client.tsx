"use client";
import { Select } from "@/frontend/components/common/input";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { TablePageSkeleton } from "@/frontend/components/common/skeleton";
import { formatDate, formatCurrency } from "@/shared/utils";
import { PROJECT_STATUS_LABELS as STATUS_LABELS, companyDisplay } from "@/frontend/constants/projects";

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

interface ProjectsClientProps {
  role: string;
}

export default function ProjectsClient({ role }: ProjectsClientProps) {
  const canCreate = role === "admin" || role === "manager";

  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const params = new URLSearchParams();
  if (companyFilter) params.set("company", companyFilter);
  if (statusFilter) params.set("status", statusFilter);
  const swrKey = `/api/projects?${params}`;

  const { data: projects = [], isLoading: loading } = useSWR<Project[]>(swrKey);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">プロジェクト一覧</h1>
          <p className="text-sm text-slate-500">{projects.length}件</p>
        </div>
        {canCreate && (
          <a href="/projects/new" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={15} /> 新規登録
          </a>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全ステータス</option>
          <option value="active">進行中</option>
          <option value="planning">計画中</option>
          <option value="completed">完了</option>
          <option value="on_hold">一時停止</option>
        </Select>
      </div>

      {/* Project table */}
      {loading ? (
        <TablePageSkeleton rows={6} cols={6} />
      ) : projects.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          該当するプロジェクトがありません
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">プロジェクト名</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">会社</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">ステータス</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-500">月額契約</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">開始日</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-500">メンバー</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <a
                      href={`/projects/${p.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {p.name}
                    </a>
                    {p.clientName && (
                      <span className="ml-2 text-xs text-slate-400">{p.clientName}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{companyDisplay(p.company)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{STATUS_LABELS[p.status] ?? p.status}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800">{formatCurrency(p.monthlyContractAmount)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(p.startDate)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{p.assignments.length}名</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
