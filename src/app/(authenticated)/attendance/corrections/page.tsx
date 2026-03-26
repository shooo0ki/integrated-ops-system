"use client";

import { useState } from "react";
import useSWR from "swr";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/frontend/components/common/button";
import { useToast } from "@/frontend/hooks/use-toast";
import { Toast } from "@/frontend/components/common/toast";
import { TablePageSkeleton } from "@/frontend/components/common/skeleton";
import type { CorrectionRecord } from "@/shared/types/attendance";

export default function CorrectionsPage() {
  const { data: corrections = [], isLoading, mutate } = useSWR<CorrectionRecord[]>(
    "/api/attendances/corrections"
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const toast = useToast();

  async function handleAction(id: string, action: "approved" | "rejected") {
    setProcessingId(id);
    mutate(
      corrections.filter((c) => c.id !== id),
      { revalidate: false }
    );
    const res = await fetch(`/api/attendances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmStatus: action }),
    });
    if (res.ok) {
      toast.show(action === "approved" ? "承認しました" : "否認しました");
    }
    await mutate();
    setProcessingId(null);
  }

  return (
    <div className="space-y-4">
      <Toast message={toast.message} />
      <div>
        <h1 className="text-xl font-bold text-slate-800">勤怠修正依頼</h1>
        <p className="text-sm text-slate-500">修正申請の確認・承認・否認</p>
      </div>

      {isLoading ? (
        <TablePageSkeleton rows={5} cols={7} />
      ) : corrections.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          承認待ちの修正依頼はありません
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">メンバー</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">日付</th>
                <th className="px-4 py-2.5 text-center font-medium text-slate-500">出勤</th>
                <th className="px-4 py-2.5 text-center font-medium text-slate-500">退勤</th>
                <th className="px-4 py-2.5 text-center font-medium text-slate-500">休憩</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-500">実働</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {corrections.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{c.memberName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.date.replace(/-/g, "/")}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{c.clockIn ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{c.clockOut ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{c.breakMinutes}分</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {c.actualHours != null ? `${c.actualHours.toFixed(1)}h` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleAction(c.id, "approved")}
                        disabled={processingId === c.id}
                      >
                        <CheckCircle size={13} />
                        承認
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleAction(c.id, "rejected")}
                        disabled={processingId === c.id}
                      >
                        <XCircle size={13} />
                        否認
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
