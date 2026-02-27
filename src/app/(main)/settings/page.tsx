"use client";

import { useState, useEffect } from "react";
import { Settings, Slack, Building2, Info, Save, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { notFound } from "next/navigation";

type Tab = "slack" | "company" | "system";

const DEFAULT_FORM = {
  slack_closing_notify_day: "25",
  company_name_primary: "",
  company_name_secondary: "",
  fiscal_year_start: "4",
  overtime_threshold: "160",
};

export default function SettingsPage() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("slack");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slackTestStatus, setSlackTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  useEffect(() => {
    fetch("/api/system-configs")
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => {
        setForm((prev) => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const configs = Object.entries(form).map(([key, value]) => ({ key, value: String(value) }));
    const res = await fetch("/api/system-configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleSlackTest() {
    setSlackTestStatus("testing");
    try {
      const res = await fetch("/api/slack/test", { method: "POST" });
      setSlackTestStatus(res.ok ? "ok" : "fail");
    } catch {
      setSlackTestStatus("fail");
    }
    setTimeout(() => setSlackTestStatus("idle"), 4000);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "slack", label: "Slack 連携", icon: <Slack size={15} /> },
    { id: "company", label: "会社情報", icon: <Building2 size={15} /> },
    { id: "system", label: "システム情報", icon: <Info size={15} /> },
  ];

  if (role !== "admin") return notFound();
  if (loading) return <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">システム設定</h1>
          <p className="text-sm text-slate-500">Slack 連携・会社情報などの管理者設定</p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saved ? <CheckCircle size={15} className="text-white" /> : <Save size={15} />}
          {saved ? "保存済み" : saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Slack Tab */}
      {activeTab === "slack" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slack Bot 設定</CardTitle>
              <Slack size={16} className="text-slate-400" />
            </CardHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Slack 連携は環境変数（<code className="font-mono">SLACK_BOT_TOKEN</code> / <code className="font-mono">SLACK_CHANNEL_*</code>）で設定します。
                Vercel のダッシュボード → Settings → Environment Variables から更新してください。
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  月末締め通知日
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.slack_closing_notify_day}
                    onChange={(e) => handleChange("slack_closing_notify_day", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">日</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">1〜28 の整数を入力してください</p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="mb-3 text-sm font-medium text-slate-700">接続テスト</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSlackTest}
                    disabled={slackTestStatus === "testing"}
                  >
                    {slackTestStatus === "testing" && <Loader2 size={14} className="animate-spin" />}
                    Slack 接続テスト
                  </Button>
                  {slackTestStatus === "ok" && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600">
                      <CheckCircle size={15} /> 接続成功
                    </span>
                  )}
                  {slackTestStatus === "fail" && (
                    <span className="flex items-center gap-1.5 text-sm text-red-600">
                      <XCircle size={15} /> 接続失敗。環境変数を確認してください
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Company Tab */}
      {activeTab === "company" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>会社情報</CardTitle>
              <Building2 size={16} className="text-slate-400" />
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  会社名（親会社） <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  maxLength={50}
                  value={form.company_name_primary}
                  onChange={(e) => handleChange("company_name_primary", e.target.value)}
                  placeholder="ブーストコンサルティング株式会社"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">会社名（子会社）</label>
                <Input
                  type="text"
                  maxLength={50}
                  value={form.company_name_secondary}
                  onChange={(e) => handleChange("company_name_secondary", e.target.value)}
                  placeholder="SALT2株式会社"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">会計年度開始月</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={form.fiscal_year_start}
                    onChange={(e) => handleChange("fiscal_year_start", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">月</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">残業判定時間</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={form.overtime_threshold}
                    onChange={(e) => handleChange("overtime_threshold", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">時間 / 月</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ロール・権限設定</CardTitle>
            </CardHeader>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">ロール・権限のカスタマイズは将来拡張予定です。</p>
              <div className="mt-3 space-y-2">
                {[
                  { role: "管理者", desc: "全機能へのフルアクセス" },
                  { role: "マネージャー", desc: "メンバー・プロジェクト管理、PL閲覧" },
                  { role: "社員", desc: "自分の勤怠・プロジェクト閲覧" },
                  { role: "インターン", desc: "自分の勤怠のみ" },
                ].map((r) => (
                  <div key={r.role} className="flex items-center gap-3 text-sm">
                    <span className="w-28 font-medium text-slate-700">{r.role}</span>
                    <span className="text-slate-500">{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* System Info Tab */}
      {activeTab === "system" && (
        <Card>
          <CardHeader>
            <CardTitle>システム情報</CardTitle>
            <Info size={16} className="text-slate-400" />
          </CardHeader>
          <div className="space-y-3">
            {[
              { label: "アプリケーション名", value: "統合業務管理システム" },
              { label: "バージョン", value: "v1.0.0" },
              { label: "フレームワーク", value: "Next.js 15 (App Router)" },
              { label: "UI ライブラリ", value: "Tailwind CSS / shadcn/ui" },
              { label: "データベース", value: "PostgreSQL + Prisma ORM" },
              { label: "認証", value: "OAuth 2.0 (Slack / Google)" },
              { label: "対応会社", value: "Boost / SALT2" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className="text-sm font-medium text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
