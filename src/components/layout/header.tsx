"use client";

import Link from "@/components/ui/app-link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User, Menu, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
}

// admin/manager がダッシュボードハブから遷移するページ（戻るボタンを表示）
const HUB_PAGES = ["/dashboard", "/mypage", "/settings"];

export function Header({ onMenuClick }: HeaderProps) {
  const { name, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  // ハブページ（dashboard/mypage/settings）以外にいる admin/manager に戻るボタンを表示
  const showBackButton =
    (role === "admin" || role === "manager") && !HUB_PAGES.includes(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-2">
        {/* モバイル: ハンバーガーボタン */}
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
          aria-label="メニューを開く"
        >
          <Menu size={20} />
        </button>

        {/* ダッシュボードへ戻るボタン（admin/manager のみ、ハブページ以外で表示） */}
        {showBackButton && (
          <Link
            href="/dashboard"
            className="hidden md:flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft size={16} />
            ダッシュボード
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* User info */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User size={14} />
          </div>
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">
            {name ?? "ゲスト"}
          </span>
        </div>

        {/* Logout */}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-slate-500">
          <LogOut size={14} />
          <span className="hidden sm:inline">ログアウト</span>
        </Button>
      </div>
    </header>
  );
}
