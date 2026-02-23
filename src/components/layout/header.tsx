"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "./role-switcher";

export function Header() {
  const { member, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div />
      <div className="flex items-center gap-3">
        {/* Role switcher (demo only) */}
        <RoleSwitcher />

        {/* User info */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User size={14} />
          </div>
          <span className="text-sm font-medium text-slate-700">
            {member?.name ?? "ゲスト"}
          </span>
        </div>

        {/* Logout */}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-slate-500">
          <LogOut size={14} />
          ログアウト
        </Button>
      </div>
    </header>
  );
}
