"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Calendar, DollarSign, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ──────────────────────────────────────────────

interface Position {
  id: string;
  positionName: string;
  requiredCount: number;
  assignmentCount: number;
}

interface Assignment {
  id: string;
  memberId: string;
  memberName: string;
  positionName: string;
  positionId: string;
  workloadHours: number;
  startDate: string;
  endDate: string | null;
}

interface ProjectDetail {
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
  positions: Position[];
  assignments: Assignment[];
}

// ─── ユーティリティ ──────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: "進行中", completed: "完了", on_hold: "一時停止", planning: "計画中",
};
const STATUS_COLOR: Record<string, "success" | "default" | "warning"> = {
  active: "success", completed: "default", on_hold: "warning", planning: "warning",
};
const CONTRACT_LABELS: Record<string, string> = {
  quasi_mandate: "準委任", contract: "請負", in_house: "自社開発", other: "その他",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}
function formatCurrency(n: number): string {
  return n.toLocaleString("ja-JP", { style: "currency", currency: "JPY" });
}

// ─── ページ ───────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { role } = useAuth();
  const canManage = role === "admin" || role === "manager";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(async (r) => {
        if (r.status === 404) { router.push("/projects"); return; }
        setProject(await r.json());
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>;
  if (!project) return null;

  const companyDisplay = project.company === "boost" ? "Boost" : "SALT2";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
          <ArrowLeft size={16} /> 一覧に戻る
        </Link>
      </div>

      {/* Header */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={project.company === "boost" ? "boost" : "salt2"}>{companyDisplay}</Badge>
              <Badge variant={STATUS_COLOR[project.status] ?? "default"}>{STATUS_LABELS[project.status] ?? project.status}</Badge>
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-800">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-slate-600">{project.description}</p>
            )}
          </div>
          {canManage && (
            <Link href={`/projects/${id}/assign`}>
              <Button variant="outline" size="sm"><UserPlus size={14} /> アサイン管理</Button>
            </Link>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Calendar size={14} className="text-slate-400" /> {formatDate(project.startDate)} 〜
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users size={14} className="text-slate-400" /> {project.assignments.length}名アサイン
          </div>
          {project.clientName && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600 col-span-2">
              クライアント: {project.clientName}
            </div>
          )}
          {(role === "admin" || role === "manager") && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <DollarSign size={14} className="text-slate-400" />
              月額: <span className="font-semibold">{formatCurrency(project.monthlyContractAmount)}</span>
            </div>
          )}
          {project.contractType && (
            <div className="text-sm text-slate-600">
              契約: {CONTRACT_LABELS[project.contractType] ?? project.contractType}
            </div>
          )}
        </div>
      </Card>

      {/* Positions */}
      {project.positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ポジション定義</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {project.positions.map((pos) => (
              <div key={pos.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{pos.positionName}</span>
                  {pos.assignmentCount >= pos.requiredCount ? (
                    <Badge variant="success">充足</Badge>
                  ) : (
                    <Badge variant="warning">空き {pos.requiredCount - pos.assignmentCount}名</Badge>
                  )}
                </div>
                <span className="text-sm text-slate-500">{pos.assignmentCount}/{pos.requiredCount}名</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>アサインメンバー</CardTitle>
        </CardHeader>
        {project.assignments.length === 0 ? (
          <p className="text-sm text-slate-400">アサインされているメンバーがいません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="py-2 text-left font-medium">名前</th>
                  <th className="py-2 text-left font-medium">ポジション</th>
                  <th className="py-2 text-right font-medium">月間工数</th>
                  <th className="py-2 text-left font-medium">開始日</th>
                </tr>
              </thead>
              <tbody>
                {project.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2">
                      <Link href={`/members/${a.memberId}`} className="font-medium text-slate-700 hover:text-blue-600">{a.memberName}</Link>
                    </td>
                    <td className="py-2 text-slate-500">{a.positionName}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{a.workloadHours}h</td>
                    <td className="py-2 text-xs text-slate-400">{formatDate(a.startDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
