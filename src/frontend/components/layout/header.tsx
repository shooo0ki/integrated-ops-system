"use client";

import { useRouter } from "next/navigation";
import { LogOut, User, Menu } from "lucide-react";
import { useAuth } from "@/frontend/contexts/auth-context";
import { Button } from "@/frontend/components/common/button";

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
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="メニューを開く"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User size={14} />
          </div>
          <span className="text-sm font-medium text-slate-700" suppressHydrationWarning>
            {name ?? "ゲスト"}
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-slate-500">
          <LogOut size={14} />
          <span>ログアウト</span>
        </Button>
      </div>
    </header>
  );
}
