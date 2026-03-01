"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  FolderOpen,
  FileText,
  TrendingUp,
  User,
  Building2,
  Wrench,
  FileCheck,
  Star,
  CalendarClock,
  CalendarDays,
  BarChart2,
  Settings,
  Wallet,
  Award,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const ALL = ["admin", "manager", "member", "intern"];
const STAFF = ["admin", "manager"];
const PRIVILEGED = ["admin", "manager"];

const navItems = [
  { href: "/dashboard",       label: "ダッシュボード",   icon: LayoutDashboard, roles: PRIVILEGED },
  { href: "/members",         label: "メンバー",         icon: Users,           roles: PRIVILEGED },
  { href: "/skills",          label: "スキルマトリクス",  icon: Star,            roles: PRIVILEGED },
  { href: "/attendance",      label: "打刻",             icon: Clock,           roles: ALL },
  { href: "/calendar",        label: "カレンダー",        icon: CalendarDays,    roles: ALL },
  { href: "/schedule",        label: "勤務予定",          icon: CalendarClock,   roles: ALL },
  { href: "/projects",        label: "プロジェクト",      icon: FolderOpen,      roles: PRIVILEGED },
  { href: "/workload",        label: "工数管理",          icon: BarChart2,       roles: PRIVILEGED },
  { href: "/tools",           label: "ツール管理",        icon: Wrench,          roles: PRIVILEGED },
  { href: "/contracts",       label: "契約管理",          icon: FileCheck,       roles: ["admin"] },
  { href: "/closing",         label: "請求管理",          icon: FileText,        roles: ALL },
  { href: "/pl/summary",      label: "PL サマリー",       icon: TrendingUp,      roles: ALL },
  { href: "/pl/cashflow",     label: "キャッシュフロー",  icon: Wallet,          roles: ["admin"] },
  { href: "/evaluation",      label: "人事評価",          icon: Award,           roles: PRIVILEGED },
  { href: "/mypage",          label: "マイページ",        icon: User,            roles: ALL },
  { href: "/settings",        label: "設定",              icon: Settings,        roles: ["admin"] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <>
      {/* デスクトップ: 常に表示 / モバイル: isOpen で固定オーバーレイ表示 */}
      <aside
        className={cn(
          "flex h-full w-56 flex-col border-r border-slate-200 bg-white",
          // デスクトップ: 通常フロー
          "hidden md:flex",
          // モバイル: 固定位置で重ねて表示
          isOpen && "fixed inset-y-0 left-0 z-30 flex"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={20} className="shrink-0 text-blue-600" />
            <p className="truncate text-sm font-bold text-slate-800">統合業務管理</p>
          </div>
          {/* モバイル: 閉じるボタン */}
          <button
            onClick={onClose}
            className="ml-2 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
            aria-label="メニューを閉じる"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-2">
            {visibleItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-400">v1.0 | Boost / SALT2</p>
        </div>
      </aside>
    </>
  );
}
