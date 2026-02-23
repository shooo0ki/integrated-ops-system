"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface PositionInput {
  positionName: string;
  requiredCount: string;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  quasi_mandate: "準委任",
  contract: "請負",
  in_house: "自社開発",
  other: "その他",
};

export default function ProjectNewPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "active",
    company: "boost",
    startDate: "",
    endDate: "",
    clientName: "",
    contractType: "quasi_mandate",
    monthlyContractAmount: "",
  });
  const [noDeadline, setNoDeadline] = useState(false);
  const [positions, setPositions] = useState<PositionInput[]>([
    { positionName: "PM", requiredCount: "1" },
    { positionName: "", requiredCount: "1" },
  ]);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }
  function setPos(i: number, k: keyof PositionInput, v: string) {
    setPositions((p) => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }
  function addPos() { setPositions((p) => [...p, { positionName: "", requiredCount: "1" }]); }
  function removePos(i: number) { setPositions((p) => p.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const validPositions = positions.filter((p) => p.positionName.trim());

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        status: form.status,
        company: form.company,
        startDate: form.startDate,
        endDate: noDeadline || !form.endDate ? null : form.endDate,
        clientName: form.clientName || undefined,
        contractType: form.contractType || undefined,
        monthlyContractAmount: form.monthlyContractAmount ? Number(form.monthlyContractAmount) : 0,
        positions: validPositions.map((p) => ({
          positionName: p.positionName,
          requiredCount: Number(p.requiredCount) || 1,
        })),
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setSubmitted(data);
    } else {
      const data = await res.json();
      setError(data.error?.message ?? "登録に失敗しました");
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">プロジェクトを登録しました</h2>
        <p className="text-sm text-slate-600">{submitted.name}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/projects")}>一覧に戻る</Button>
          <Button variant="primary" onClick={() => router.push(`/projects/${submitted.id}`)}>詳細を見る</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
          <ArrowLeft size={16} /> 戻る
        </Link>
        <h1 className="text-xl font-bold text-slate-800">プロジェクト登録</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">基本情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input id="name" label="プロジェクト名 *" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="〇〇社 AI 開発" required />
            </div>
            <Select id="company" label="会社 *" value={form.company} onChange={(e) => set("company", e.target.value)}>
              <option value="boost">Boost</option>
              <option value="salt2">SALT2</option>
            </Select>
            <Select id="status" label="ステータス *" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">進行中</option>
              <option value="planning">計画中</option>
              <option value="on_hold">一時停止</option>
              <option value="completed">完了</option>
            </Select>
            <Input id="startDate" type="date" label="開始日 *" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
            <div>
              {!noDeadline && (
                <Input id="endDate" type="date" label="終了日（予定）" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              )}
              <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noDeadline}
                  onChange={(e) => { setNoDeadline(e.target.checked); if (e.target.checked) set("endDate", ""); }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                期限なし（継続中プロジェクト）
              </label>
            </div>
            <Input id="clientName" label="クライアント名" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="株式会社〇〇" />
            <Select id="contractType" label="契約形態" value={form.contractType} onChange={(e) => set("contractType", e.target.value)}>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
            <Input id="monthlyContractAmount" type="number" label="月額契約金額（円）" value={form.monthlyContractAmount} onChange={(e) => set("monthlyContractAmount", e.target.value)} placeholder="500000" />
          </div>
          <div className="mt-3">
            <label className="text-sm font-medium text-slate-700">説明</label>
            <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="プロジェクトの概要" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">ポジション定義</h2>
            <Button type="button" variant="outline" size="sm" onClick={addPos}><Plus size={14} /> 追加</Button>
          </div>
          <div className="space-y-3">
            {positions.map((pos, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input id={`pos-name-${i}`} placeholder="ポジション名（例: PM）" value={pos.positionName} onChange={(e) => setPos(i, "positionName", e.target.value)} className="flex-1" />
                <Input id={`pos-count-${i}`} type="number" placeholder="人数" value={pos.requiredCount} onChange={(e) => setPos(i, "requiredCount", e.target.value)} className="w-20" />
                <button type="button" onClick={() => removePos(i)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/projects"><Button type="button" variant="outline">キャンセル</Button></Link>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "登録中..." : "登録する"}
          </Button>
        </div>
      </form>
    </div>
  );
}
