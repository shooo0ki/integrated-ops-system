"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, FileText, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── 型定義 ──────────────────────────────────────────────

interface Invoice {
  id: string;
  memberId: string;
  memberName: string;
  salaryType: string;
  invoiceNumber: string;
  targetMonth: string;
  workHoursTotal: number;
  unitPrice: number;
  amountExclTax: number;
  amountInclTax: number;
  slackSentStatus: string;
  issuedAt: string;
}

interface ClosingRecord {
  memberId: string;
  memberName: string;
  salaryType: string;
  salaryAmount: number;
  workDays: number;
  totalHours: number;
  estimatedAmount: number;
  invoiceStatus: string;
}

// ─── ユーティリティ ──────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(v);
}

function buildMonthOptions() {
  const opts: string[] = [];
  const base = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    opts.push(d.toISOString().slice(0, 7));
  }
  return opts;
}

const receiptConfig: Record<string, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
  none:            { label: "未受領",       variant: "default" },
  generated:       { label: "未受領",       variant: "default" },
  sent:            { label: "受領済み",     variant: "warning" },
  approved:        { label: "確認済み",     variant: "success" },
  accounting_sent: { label: "経理処理済",   variant: "info" },
};

// ─── Admin View ───────────────────────────────────────────

function AdminView() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [closing, setClosing] = useState<ClosingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const monthOptions = buildMonthOptions();

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes, closingRes] = await Promise.all([
      fetch(`/api/invoices?month=${month}`),
      fetch(`/api/closing?month=${month}`),
    ]);
    if (invRes.ok) setInvoices(await invRes.json());
    if (closingRes.ok) setClosing(await closingRes.json());
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // 請求書があるメンバー と ない（closing のみ）メンバーを合算
  const hourlyClosing = closing.filter((c) => c.salaryType === "hourly");
  const salaryClosing = closing.filter((c) => c.salaryType === "monthly");

  const hourlyLaborCost = hourlyClosing.reduce((s, c) => s + c.estimatedAmount, 0);
  const salaryLaborCost = salaryClosing.reduce((s, c) => s + c.salaryAmount, 0);
  const totalLaborCost = hourlyLaborCost + salaryLaborCost;

  const hourlyReceived = invoices.filter((i) => i.slackSentStatus === "sent").length;
  const totalCount = closing.length;
  const notReceivedCount = totalCount - hourlyReceived;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">請求書受領管理</h1>
          <p className="text-sm text-slate-500">全メンバーの人件費と請求書受領状況</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-slate-500">総人件費（当月見込み）</p>
          <p className="mt-1 text-xl font-bold text-blue-700">{formatCurrency(totalLaborCost)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">受領済み</p>
          <p className={`mt-1 text-2xl font-bold ${hourlyReceived > 0 ? "text-green-600" : "text-slate-400"}`}>
            {hourlyReceived}
            <span className="ml-1 text-sm font-normal text-slate-500">/ {totalCount}名</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">未受領</p>
          <p className={`mt-1 text-2xl font-bold ${notReceivedCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
            {notReceivedCount}
            <span className="ml-1 text-sm font-normal text-slate-500">名</span>
          </p>
        </Card>
      </div>

      {notReceivedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={15} className="shrink-0" />
          請求書が未受領のメンバーが <strong>{notReceivedCount}名</strong> います。
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 時給制テーブル */}
          <Card noPadding>
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-600">時給制（インターン・業務委託）</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">メンバー</th>
                    <th className="px-4 py-3 text-right font-medium">稼働時間</th>
                    <th className="px-4 py-3 text-right font-medium">時給</th>
                    <th className="px-4 py-3 text-right font-medium">人件費</th>
                    <th className="px-4 py-3 text-left font-medium">請求書受領</th>
                    <th className="px-4 py-3 text-left font-medium">請求書番号</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyClosing.map((rec) => {
                    const inv = invoices.find((i) => i.memberId === rec.memberId);
                    const status = inv ? (inv.slackSentStatus === "sent" ? "sent" : "generated") : "none";
                    const cfg = receiptConfig[status];
                    return (
                      <tr key={rec.memberId} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{rec.memberName}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{rec.totalHours}h</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">
                          {formatCurrency(rec.salaryAmount)}/h
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {inv ? formatCurrency(inv.amountExclTax) : formatCurrency(rec.estimatedAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {inv?.invoiceNumber ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {hourlyClosing.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-slate-400">データがありません</td>
                    </tr>
                  )}
                </tbody>
                {hourlyClosing.length > 0 && (
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-slate-600">小計</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-700">
                        {formatCurrency(hourlyLaborCost)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {/* 給与制テーブル */}
          {salaryClosing.length > 0 && (
            <Card noPadding>
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-slate-600">月給制（正社員・役員）</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr className="text-xs text-slate-500">
                      <th className="px-4 py-3 text-left font-medium">メンバー</th>
                      <th className="px-4 py-3 text-right font-medium">月額</th>
                      <th className="px-4 py-3 text-left font-medium">請求書受領</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryClosing.map((m) => (
                      <tr key={m.memberId} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{m.memberName}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {formatCurrency(m.salaryAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default">未受領</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td className="px-4 py-2 text-xs font-semibold text-slate-600">小計</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-700">
                        {formatCurrency(salaryLaborCost)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* 合計 */}
          <div className="flex justify-end rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-right">
              <p className="text-xs text-slate-500">総人件費合計</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(totalLaborCost)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Member View ──────────────────────────────────────────

function MemberView({ memberId }: { memberId: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [closing, setClosing] = useState<ClosingRecord | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const monthOptions = buildMonthOptions();

  const load = useCallback(async () => {
    setLoading(true);
    setSubmitted(false);
    setInvoice(null);
    setClosing(null);

    const [closingRes, invRes] = await Promise.all([
      fetch(`/api/closing?month=${month}`),
      fetch(`/api/invoices?month=${month}&mine=1`),
    ]);

    if (closingRes.ok) {
      const all: ClosingRecord[] = await closingRes.json();
      const mine = all.find((r) => r.memberId === memberId);
      setClosing(mine ?? null);
    }
    if (invRes.ok) {
      const inv = await invRes.json();
      if (inv) {
        setInvoice(inv);
        setSubmitted(true);
      }
    }
    setLoading(false);
  }, [month, memberId]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!closing) return;
    setSubmitting(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMonth: month,
        workHoursTotal: closing.totalHours,
        unitPrice: closing.salaryAmount,
        note,
      }),
    });
    if (res.ok) {
      setSubmitted(true);
      await load();
    }
    setSubmitting(false);
  }

  const billingAmount = invoice?.amountExclTax ?? (closing ? closing.estimatedAmount : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">請求書の生成</h1>
          <p className="text-sm text-slate-500">{month.replace("-", "年")}月</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>{m.replace("-", "年")}月</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
      ) : (
        <>
          {/* 請求金額サマリー */}
          <Card>
            <CardHeader>
              <CardTitle>今月の請求金額</CardTitle>
            </CardHeader>
            {closing ? (
              <div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">稼働日数</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">{closing.workDays}日</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">合計時間</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">{closing.totalHours}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">時給</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">
                      {formatCurrency(closing.salaryAmount)}/h
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
                  <p className="text-xs text-slate-500">請求金額（税抜）</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(billingAmount)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {closing.totalHours}h × {formatCurrency(closing.salaryAmount)}/h = {formatCurrency(billingAmount)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">この月の勤怠データがありません</p>
            )}
          </Card>

          {/* 提出フォーム or 完了 */}
          {submitted ? (
            <Card>
              <div className="flex flex-col items-center gap-2 py-8">
                <CheckCircle size={36} className="text-green-500" />
                <p className="font-medium text-slate-700">請求書を生成しました</p>
                {invoice && (
                  <p className="text-sm text-slate-500">請求書番号: {invoice.invoiceNumber}</p>
                )}
                <p className="text-xs text-slate-400">生成した請求書を管理者へ送付してください</p>
                <button
                  className="mt-2 text-xs text-slate-400 underline hover:text-slate-600"
                  onClick={() => setSubmitted(false)}
                >
                  内容を確認する
                </button>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  <FileText size={16} className="inline mr-1" />
                  請求書の生成
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  上記の内容を確認のうえ請求書を生成してください。<br />
                  生成後、管理者へ送付してください。
                </p>
                <div>
                  <label className="text-sm font-medium text-slate-700">備考（任意）</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="交通費・特記事項などがあれば記載してください"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting || !closing}
                >
                  <FileText size={16} />
                  {submitting ? "生成中..." : "請求書を生成する"}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function InvoicesPage() {
  const { role, memberId } = useAuth();
  const isAdminOrManager = role === "admin" || role === "manager";

  if (isAdminOrManager) return <AdminView />;
  return <MemberView memberId={memberId ?? ""} />;
}
