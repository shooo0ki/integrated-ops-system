"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
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
  memberCompany: string;
  positionId: string;
  positionName: string;
  workloadHours: number;
  startDate: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  positions: Position[];
  assignments: Assignment[];
}

interface MemberOption {
  id: string;
  name: string;
  company: string;
  role: string;
  status: string;
}

// ─── ページ ───────────────────────────────────────────────

export default function AssignPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { role } = useAuth();
  const canManage = role === "admin" || role === "manager";

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ memberId: "", positionId: "", workloadHours: "80", startDate: today });

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setProject({
      id: data.id,
      name: data.name,
      positions: data.positions,
      assignments: data.assignments,
    });
  }, [id]);

  useEffect(() => {
    Promise.all([
      loadProject(),
      fetch("/api/members").then((r) => r.json()).then(setMembers),
    ]).finally(() => setLoading(false));
  }, [loadProject]);

  async function handleAdd() {
    if (!form.memberId || !form.positionId || !form.startDate) {
      setError("メンバー・ポジション・開始日を選択してください");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/projects/${id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionId: form.positionId,
        memberId: form.memberId,
        workloadHours: Number(form.workloadHours),
        startDate: form.startDate,
      }),
    });
    setSaving(false);
    if (res.ok) {
      await loadProject();
      setAddOpen(false);
      setForm({ memberId: "", positionId: "", workloadHours: "80", startDate: today });
    } else {
      const data = await res.json();
      setError(data.error?.message ?? "登録に失敗しました");
    }
  }

  async function handleDelete(assignId: string) {
    setDeleteId(assignId);
    const res = await fetch(`/api/projects/${id}/assignments/${assignId}`, { method: "DELETE" });
    setDeleteId(null);
    if (res.ok) {
      await loadProject();
    }
  }

  if (loading) return <div className="py-20 text-center text-slate-400 text-sm">読み込み中...</div>;
  if (!project) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
            <ArrowLeft size={16} /> 詳細に戻る
          </Link>
          <h1 className="text-xl font-bold text-slate-800">アサイン管理 — {project.name}</h1>
        </div>
        {canManage && (
          <Button variant="primary" size="sm" onClick={() => { setError(""); setAddOpen(true); }}>
            <Plus size={14} /> アサイン追加
          </Button>
        )}
      </div>

      {/* Positions */}
      {project.positions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {project.positions.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm font-medium text-slate-800">{p.positionName}</span>
              {p.assignmentCount >= p.requiredCount ? (
                <Badge variant="success" className="ml-2">充足</Badge>
              ) : (
                <Badge variant="warning" className="ml-2">空き{p.requiredCount - p.assignmentCount}名</Badge>
              )}
              <span className="ml-2 text-xs text-slate-400">{p.assignmentCount}/{p.requiredCount}名</span>
            </div>
          ))}
        </div>
      )}

      {/* Current assignments */}
      <Card>
        <CardHeader><CardTitle>現在のアサイン</CardTitle></CardHeader>
        {project.assignments.length === 0 ? (
          <p className="text-sm text-slate-400">アサインされているメンバーがいません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="py-2 text-left font-medium">メンバー</th>
                  <th className="py-2 text-left font-medium">ポジション</th>
                  <th className="py-2 text-right font-medium">月間工数</th>
                  <th className="py-2 text-left font-medium">開始日</th>
                  {canManage && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {project.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-800">
                      <Link href={`/members/${a.memberId}`} className="hover:text-blue-600">{a.memberName}</Link>
                      <Badge variant={a.memberCompany === "boost" ? "boost" : "salt2"} className="ml-2 text-[10px]">
                        {a.memberCompany === "boost" ? "Boost" : "SALT2"}
                      </Badge>
                    </td>
                    <td className="py-2 text-slate-500">{a.positionName}</td>
                    <td className="py-2 text-right font-medium text-slate-700">{a.workloadHours}h/月</td>
                    <td className="py-2 text-xs text-slate-400">{new Date(a.startDate).toLocaleDateString("ja-JP")}</td>
                    {canManage && (
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deleteId === a.id}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="アサイン解除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="アサイン追加">
        <div className="space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Select id="memberId" label="メンバー *" value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}>
            <option value="">選択してください</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.company === "boost" ? "Boost" : "SALT2"})</option>
            ))}
          </Select>
          <Select id="positionId" label="ポジション *" value={form.positionId} onChange={(e) => setForm((f) => ({ ...f, positionId: e.target.value }))}>
            <option value="">選択してください</option>
            {project.positions.map((p) => <option key={p.id} value={p.id}>{p.positionName}</option>)}
          </Select>
          <Input id="workloadHours" type="number" label="月間工数（時間）" value={form.workloadHours} onChange={(e) => setForm((f) => ({ ...f, workloadHours: e.target.value }))} />
          <Input id="startDate" type="date" label="開始日 *" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>キャンセル</Button>
            <Button variant="primary" onClick={handleAdd} disabled={saving}>
              {saving ? "登録中..." : "登録"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
