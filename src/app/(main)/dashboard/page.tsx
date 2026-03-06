"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, CalendarDays, FileText, TrendingUp, Wallet, Award,
  FolderOpen, BarChart2, Star, Users, Wrench, FileCheck, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

const DAILY: NavItem[] = [
  { label: "打刻",       href: "/attendance", icon: Clock,        description: "出退勤の記録" },
  { label: "カレンダー", href: "/calendar",   icon: CalendarDays, description: "チームの勤怠確認" },
];

const MONTHLY: NavItem[] = [
  { label: "請求書管理",       href: "/closing",      icon: FileText,   description: "月次締め・請求" },
  { label: "PLサマリー",       href: "/pl/summary",   icon: TrendingUp, description: "損益サマリー" },
  { label: "キャッシュフロー", href: "/pl/cashflow",  icon: Wallet,     description: "CF管理" },
  { label: "人事評価",         href: "/evaluation",   icon: Award,      description: "PAS評価" },
];

const PROJECTS: NavItem[] = [
  { label: "プロジェクト",     href: "/projects", icon: FolderOpen, description: "PJ一覧・管理" },
  { label: "工数管理",         href: "/workload",  icon: BarChart2,  description: "稼働状況" },
  { label: "スキルマトリクス", href: "/skills",    icon: Star,       description: "スキル評価" },
];

const MEMBERS: NavItem[] = [
  { label: "メンバー",   href: "/members",   icon: Users,     description: "メンバー管理" },
  { label: "ツール関連", href: "/tools",     icon: Wrench,    description: "ツールコスト" },
  { label: "契約関連",  href: "/contracts", icon: FileCheck, description: "契約書管理" },
];

function NavCard({ label, href, icon: Icon, description }: NavItem) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
          <Icon size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>
      <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
    </Link>
  );
}

function Section({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <NavCard key={item.href} {...item} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { role, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && role === "member") {
      router.replace("/mypage");
    }
  }, [authLoading, role, router]);

  // auth確定待ち、またはmemberリダイレクト中は何も表示しない
  if (authLoading || role === "member") return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ダッシュボード</h1>
        <p className="text-sm text-slate-500">業務メニュー</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Section title="毎日使うもの" items={DAILY} />
        <Section title="月末確認" items={MONTHLY} />
        <Section title="プロジェクト関連" items={PROJECTS} />
        <Section title="メンバー関連" items={MEMBERS} />
      </div>
    </div>
  );
}
