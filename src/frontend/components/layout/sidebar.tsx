"use client";

import { usePathname } from "next/navigation";
import {
  Clock,
  FileText,
  TrendingUp,
  User,
  Building2,
  CalendarDays,
  CalendarClock,
  Settings,
  X,
  FolderOpen,
  BarChart2,
  Star,
  Users,
  Wrench,
  FileCheck,
  Wallet,
  Award,
  LayoutDashboard,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useAuth } from "@/frontend/contexts/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const DAILY: NavGroup = {
  title: "勤怠管理",
  items: [
    { href: "/attendance",      label: "打刻",         icon: Clock },
    { href: "/attendance/list", label: "勤怠修正申請", icon: ClipboardCheck },
    { href: "/calendar",        label: "カレンダー",   icon: CalendarDays },
    { href: "/schedule",        label: "勤務予定",     icon: CalendarClock },
  ],
};

const ADMIN_DAILY: NavGroup = {
  title: "勤怠管理",
  items: [
    { href: "/attendance",             label: "打刻",         icon: Clock },
    { href: "/attendance/corrections", label: "勤怠修正確認", icon: ClipboardCheck },
    { href: "/calendar",               label: "カレンダー",   icon: CalendarDays },
    { href: "/schedule",               label: "勤務予定",     icon: CalendarClock },
  ],
};

const MONTHLY: NavGroup = {
  title: "月末確認",
  items: [
    { href: "/closing",      label: "請求管理",       icon: FileText },
    { href: "/pl/summary",   label: "PLサマリー",     icon: TrendingUp },
    { href: "/pl/cashflow",  label: "キャッシュフロー", icon: Wallet },
  ],
};

const PROJECTS: NavGroup = {
  title: "プロジェクト管理",
  items: [
    { href: "/projects",   label: "プロジェクト",     icon: FolderOpen },
    { href: "/workload",   label: "工数管理",         icon: BarChart2 },
    { href: "/skills",     label: "スキルマトリクス", icon: Star },
    { href: "/evaluation", label: "人事評価",         icon: Award },
  ],
};

const MEMBERS_GROUP: NavGroup = {
  title: "メンバー関連",
  items: [
    { href: "/members",   label: "メンバー", icon: Users },
    { href: "/tools",     label: "ツール",   icon: Wrench },
    { href: "/contracts", label: "契約",     icon: FileCheck },
  ],
};

// admin/manager: 全グループ表示（勤怠修正確認を含む）
const ADMIN_GROUPS: NavGroup[] = [ADMIN_DAILY, MONTHLY, PROJECTS, MEMBERS_GROUP];

// member: 日常業務のみ（月末確認は請求管理・PLまで）
const MEMBER_GROUPS: NavGroup[] = [
  DAILY,
  { title: "月末確認", items: [
    { href: "/self-reports", label: "工数申告",   icon: ClipboardCheck },
    { href: "/closing",      label: "請求管理",   icon: FileText },
    { href: "/pl/summary",   label: "PLサマリー", icon: TrendingUp },
  ]},
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, isLoading } = useAuth();

  const isPrivileged = role === "admin" || role === "manager";
  const groups = isPrivileged ? ADMIN_GROUPS : MEMBER_GROUPS;

  // 下部固定リンク
  const bottomItems: NavItem[] = isPrivileged
    ? [
        { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
        { href: "/mypage",    label: "マイページ",     icon: User },
        { href: "/settings",  label: "設定",           icon: Settings },
      ]
    : [
        { href: "/mypage", label: "マイページ", icon: User },
      ];

  function isActive(href: string) {
    if (pathname === href) return true;
    // サブパスを持つルートは完全一致のみ（/attendance が /attendance/corrections にも反応するのを防ぐ）
    const exactMatchRoutes = ["/attendance", "/dashboard", "/mypage"];
    if (exactMatchRoutes.includes(href)) return false;
    return pathname.startsWith(href + "/");
  }

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

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2" suppressHydrationWarning>
          {isLoading ? (
            <div className="space-y-1.5 px-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.title}
                  </p>
                  <ul className="space-y-0.5 px-2">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                            isActive(item.href)
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <item.icon size={15} />
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom links */}
        <div className="border-t border-slate-200 px-2 py-2">
          <ul className="space-y-0.5">
            {bottomItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <item.icon size={15} />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-3 text-[10px] text-slate-300">v1.0 | Boost / SALT2</p>
        </div>
      </aside>
    </>
  );
}
