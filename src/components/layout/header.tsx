"use client";

import { useRouter } from "next/navigation";
import { LogOut, User, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "./role-switcher";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { name, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      {/* モバイル: ハンバーガーボタン / デスクトップ: 非表示 */}
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
        aria-label="メニューを開く"
      >
        <Menu size={20} />
      </button>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role switcher (demo only) */}
        <RoleSwitcher />

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
