"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/frontend/components/layout/sidebar";
import { Header } from "@/frontend/components/layout/header";
import { useAuth } from "@/frontend/contexts/auth-context";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("sidebar") !== "closed";
  });
  const [isMobile, setIsMobile] = useState(false);

  // 開閉状態を永続化
  useEffect(() => {
    localStorage.setItem("sidebar", sidebarOpen ? "open" : "closed");
  }, [sidebarOpen]);

  // モバイル判定
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push("/login?reason=expired");
    }
  }, [isLoading, isLoggedIn, router]);

  // ローディング中はスピナー表示
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // リダイレクト待ち — 何も描画しない (スピナーフラッシュ防止)
  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* モバイル時のみ暗転backdrop表示 */}
      {sidebarOpen && isMobile && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 20, backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={isMobile} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
