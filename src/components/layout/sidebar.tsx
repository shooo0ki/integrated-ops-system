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
  ClipboardList,
  BarChart2,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/dashboard",       label: "ダッシュボード",   icon: LayoutDashboard, roles: ["admin", "manager", "member"] },
  { href: "/members",         label: "メンバー",         icon: Users,           roles: ["admin", "manager"] },
  { href: "/skills",          label: "スキルマトリクス",  icon: Star,            roles: ["admin", "manager", "member"] },
  { href: "/attendance",      label: "打刻",             icon: Clock,           roles: ["admin", "manager", "member"] },
  { href: "/calendar",        label: "カレンダー",        icon: CalendarDays,    roles: ["admin", "manager", "member"] },
  { href: "/schedule",        label: "勤務予定",          icon: CalendarClock,   roles: ["admin", "manager", "member"] },
  { href: "/attendance/list", label: "勤怠一覧",          icon: ClipboardList,   roles: ["admin", "manager", "member"] },
  { href: "/projects",        label: "プロジェクト",      icon: FolderOpen,      roles: ["admin", "manager", "member"] },
  { href: "/workload",        label: "工数管理",          icon: BarChart2,       roles: ["admin", "manager"] },
  { href: "/tools",           label: "ツール管理",        icon: Wrench,          roles: ["admin", "manager"] },
  { href: "/contracts",       label: "契約管理",          icon: FileCheck,       roles: ["admin"] },
  { href: "/closing",         label: "月末締め",          icon: CalendarClock,   roles: ["admin"] },
  { href: "/invoices",        label: "請求書管理",        icon: FileText,        roles: ["admin", "manager", "member"] },
  { href: "/pl/summary",      label: "PL サマリー",       icon: TrendingUp,      roles: ["admin", "manager", "member"] },
  { href: "/pl/cashflow",     label: "キャッシュフロー",  icon: Wallet,          roles: ["admin"] },
  { href: "/mypage",          label: "マイページ",        icon: User,            roles: ["admin", "manager", "member"] },
  { href: "/settings",        label: "設定",              icon: Settings,        roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, member } = useAuth();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <aside className="flex h-full w-56 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <Building2 size={20} className="text-blue-600" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">統合業務管理</p>
          <p className="text-xs text-slate-500">{member?.company ?? "—"}</p>
        </div>
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
  );
}
