"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  phone: "",
  company: "boost",
  role: "employee",
  status: "employee",
  salaryType: "monthly",
  salaryAmount: "",
  joinedAt: "",
};

export default function MemberNewPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        salaryAmount: Number(form.salaryAmount),
      }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      setCreated({ name: data.name, email: data.email });
    } else {
      const data = await res.json();
      setError(data.error?.message ?? "登録に失敗しました");
    }
  }

  if (created) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">メンバーを登録しました</h2>
        <p className="text-sm text-slate-500">
          {created.name}（{created.email}）を登録しました。
        </p>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => router.push("/members")}>
            一覧に戻る
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setCreated(null);
              setForm(INITIAL_FORM);
            }}
          >
            続けて登録
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/members" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
          <ArrowLeft size={16} />
          戻る
        </Link>
        <h1 className="text-xl font-bold text-slate-800">メンバー登録</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">基本情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="name"
              label="氏名 *"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="佐藤 健太"
              required
            />
            <Input
              id="email"
              type="email"
              label="メールアドレス *"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="email@example.com"
              required
            />
            <Input
              id="password"
              type="password"
              label="初期パスワード *"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="8文字以上"
              required
            />
            <Input
              id="phone"
              label="電話番号"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="090-0000-0000"
            />
            <Select
              id="company"
              label="会社 *"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              required
            >
              <option value="boost">Boost</option>
              <option value="salt2">SALT2</option>
            </Select>
            <Select
              id="role"
              label="ロール *"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              required
            >
              <option value="admin">管理者</option>
              <option value="manager">マネージャー</option>
              <option value="employee">社員</option>
              <option value="intern">インターン</option>
            </Select>
            <Select
              id="status"
              label="ステータス *"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              required
            >
              <option value="executive">役員</option>
              <option value="employee">社員</option>
              <option value="intern_full">インターン（長期）</option>
              <option value="intern_training">インターン（研修）</option>
              <option value="training_member">研修生</option>
            </Select>
            <Input
              id="joinedAt"
              type="date"
              label="入社日 *"
              value={form.joinedAt}
              onChange={(e) => set("joinedAt", e.target.value)}
              required
            />
          </div>
        </Card>

        {/* Contract Info */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">報酬情報</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              id="salaryType"
              label="給与種別 *"
              value={form.salaryType}
              onChange={(e) => set("salaryType", e.target.value)}
              required
            >
              <option value="monthly">月給制</option>
              <option value="hourly">時給制</option>
            </Select>
            <Input
              id="salaryAmount"
              type="number"
              label={form.salaryType === "monthly" ? "月額（円） *" : "時給（円） *"}
              value={form.salaryAmount}
              onChange={(e) => set("salaryAmount", e.target.value)}
              placeholder={form.salaryType === "monthly" ? "400000" : "1500"}
              required
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/members">
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "登録中..." : "登録する"}
          </Button>
        </div>
      </form>
    </div>
  );
}
