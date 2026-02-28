"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { login, isLoggedIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("sato@example.com");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      router.push("/dashboard");
    }
  }, [isLoggedIn, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error ?? "ログインに失敗しました。");
      }
    } catch {
      setError("通信エラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const demoAccounts = [
    { label: "管理者", email: "sato@example.com" },
    { label: "マネージャー", email: "tanaka@example.com" },
    { label: "社員", email: "suzuki@example.com" },
    { label: "インターン", email: "yamada@example.com" },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <Building2 size={28} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">統合業務管理システム</h1>
            <p className="mt-1 text-sm text-slate-500">Boost / SALT2</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">ログイン</h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
            />
            <Input
              id="password"
              type="password"
              label="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold text-amber-700">デモアカウント（パスワード: Password123）</p>
          <div className="grid grid-cols-2 gap-1.5">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("Password123");
                }}
                className="rounded-md bg-white px-3 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                <span className="font-medium">{acc.label}</span>
                <br />
                <span className="text-amber-600">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">v1.0 | Boost / SALT2 統合業務管理システム</p>
      </div>
    </div>
  );
}
