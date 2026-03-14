"use client";
import { Select } from "@/frontend/components/common/input";

import { useState } from "react";
import useSWR from "swr";
import Link from "@/frontend/components/common/prefetch-link";
import { Search, Plus, User } from "lucide-react";
import { Card } from "@/frontend/components/common/card";
import { Button } from "@/frontend/components/common/button";
import { roleLabel } from "@/frontend/constants/common";
import { MEMBER_STATUS_LABELS as statusLabel, MEMBER_STATUS_COLORS as statusColor } from "@/frontend/constants/members";
import { CardGridPageSkeleton } from "@/frontend/components/common/skeleton";

// ─── 型定義 ──────────────────────────────────────────────

interface MemberListItem {
  id: string;
  name: string;
  status: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  email: string;
  role: string;
}

// ─── クライアントコンポーネント ───────────────────────────

interface MembersClientProps {
  role: string;
}

export default function MembersClient({ role }: MembersClientProps) {
  const canCreate = role === "admin" || role === "manager";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (roleFilter) params.set("role", roleFilter);
  const swrKey = `/api/members?${params}`;

  const { data: members = [], isLoading: loading } = useSWR<MemberListItem[]>(swrKey);

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
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">全ロール</option>
          <option value="admin">管理者</option>
          <option value="manager">マネージャー</option>
          <option value="member">メンバー</option>
        </Select>
      </div>

      {/* Member grid */}
      {loading ? (
        <CardGridPageSkeleton count={6} cols={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <Link key={member.id} href={`/members/${member.id}`} prefetch={false}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <User size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{member.name}</span>
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
