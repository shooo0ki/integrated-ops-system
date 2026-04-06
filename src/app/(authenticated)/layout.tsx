"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/frontend/components/layout/sidebar";
import { Header } from "@/frontend/components/layout/header";
import { useAuth } from "@/frontend/contexts/auth-context";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ページ遷移時にモバイルサイドバーを閉じる
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // セッション切れ時にメッセージ付きでリダイレクト (要件 C-01 v2)
      router.push("/login?reason=expired");
    }
  }, [isLoading, isLoggedIn, router]);

  if (!isLoading && !isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
