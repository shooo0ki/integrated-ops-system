"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Plus, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// DB から返るメンバーの型
interface MemberListItem {
  id: string;
  name: string;
  status: string;
  company: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  email: string;
  role: string;
}

const statusLabel: Record<string, string> = {
  executive: "役員",
  employee: "社員",
  intern_full: "インターン（長期）",
  intern_training: "インターン（研修）",
  training_member: "研修生",
};

const statusColor: Record<string, string> = {
  executive: "bg-purple-50 text-purple-700",
  employee: "bg-blue-50 text-blue-700",
  intern_full: "bg-orange-50 text-orange-700",
  intern_training: "bg-orange-50 text-orange-700",
  training_member: "bg-slate-50 text-slate-700",
};

const roleLabel: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  employee: "社員",
  intern: "インターン",
};

const companyDisplay = (c: string) =>
  c === "boost" ? "Boost" : c === "salt2" ? "SALT2" : c;

export default function MembersPage() {
  const { role } = useAuth();
  const canCreate = role === "admin" || role === "manager";

  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (companyFilter) params.set("company", companyFilter);
    if (roleFilter) params.set("role", roleFilter);

    setLoading(true);
    fetch(`/api/members?${params}`)
      .then((r) => r.json())
      .then((data) => setMembers(data))
      .finally(() => setLoading(false));
  }, [search, companyFilter, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">メンバー一覧</h1>
          <p className="text-sm text-slate-500">{members.length}名</p>
        </div>
        {canCreate && (
          <Link href="/members/new">
            <Button variant="primary" size="sm">
              <Plus size={16} />
              メンバー登録
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="名前・メールで検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">全社</option>
          <option value="boost">Boost</option>
          <option value="salt2">SALT2</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">全ロール</option>
          <option value="admin">管理者</option>
          <option value="manager">マネージャー</option>
          <option value="employee">社員</option>
          <option value="intern">インターン</option>
        </select>
      </div>

      {/* Member grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">読み込み中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <Link key={member.id} href={`/members/${member.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <User size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{member.name}</span>
                        <span className="text-xs text-slate-400">{companyDisplay(member.company)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusColor[member.status] ?? "bg-slate-50 text-slate-700"}`}
                        >
                          {statusLabel[member.status] ?? member.status}
                        </span>
                        <span className="text-xs text-slate-500">{roleLabel[member.role] ?? member.role}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 truncate">{member.email}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {members.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              <User size={32} className="mx-auto mb-2 text-slate-300" />
              <p>該当するメンバーが見つかりません</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
