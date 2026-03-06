"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  FileText,
  TrendingUp,
  User,
  Building2,
  CalendarDays,
  CalendarClock,
  Settings,
  Wallet,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

// admin/manager がダッシュボードハブから遷移するページ（戻るリンクを表示）
const HUB_PAGES = ["/dashboard", "/mypage", "/settings"];

// admin / manager: ダッシュボード（ハブ）・マイページ・設定のみ
const PRIVILEGED_NAV: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/mypage",    label: "マイページ",     icon: User },
  { href: "/settings",  label: "設定",           icon: Settings },
];

// member / intern: 日常業務のナビゲーション
const MEMBER_NAV: NavItem[] = [
  { href: "/attendance", label: "打刻",     icon: Clock },
  { href: "/calendar",   label: "カレンダー", icon: CalendarDays },
  { href: "/schedule",   label: "勤務予定",  icon: CalendarClock },
  { href: "/closing",    label: "請求管理",  icon: FileText },
  { href: "/pl/summary", label: "PLサマリー", icon: TrendingUp },
  { href: "/pl/cashflow",label: "キャッシュフロー", icon: Wallet },
  { href: "/mypage",     label: "マイページ", icon: User },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();

  const isPrivileged = role === "admin" || role === "manager";
  const navItems = isPrivileged ? PRIVILEGED_NAV : MEMBER_NAV;
  const showBackLink = isPrivileged && !HUB_PAGES.includes(pathname);

  return (
    <>
      <aside
        className={cn(
          "flex h-full w-56 flex-col border-r border-slate-200 bg-white",
          "hidden md:flex",
          isOpen && "fixed inset-y-0 left-0 z-30 flex"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={20} className="shrink-0 text-blue-600" />
            <p className="truncate text-sm font-bold text-slate-800">統合業務管理</p>
          </div>
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
            {/* モバイル: 非ハブページにいる admin/manager 向け戻るリンク */}
            {showBackLink && (
              <li className="md:hidden">
                <Link
                  href="/dashboard"
                  prefetch={false}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <ChevronLeft size={16} />
                  ダッシュボードに戻る
                </Link>
              </li>
            )}
            {navItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    prefetch={false}
                    href={item.href}
                    onClick={onClose}
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
