"use client";
import { Select } from "@/frontend/components/common/input";

import { useState } from "react";
import useSWR from "swr";
import Link from "@/frontend/components/common/prefetch-link";
import { Search, Plus } from "lucide-react";
import { Button } from "@/frontend/components/common/button";
import { roleLabel } from "@/frontend/constants/common";
import { MEMBER_STATUS_LABELS as statusLabel } from "@/frontend/constants/members";
import { TablePageSkeleton } from "@/frontend/components/common/skeleton";

interface MemberListItem {
  id: string;
  name: string;
  status: string;
  salaryType: string;
  salaryAmount: number;
  joinedAt: string;
  leftAt: string | null;
  email: string;
  role: string;
}

interface MembersClientProps {
  role: string;
}

export default function MembersClient({ role }: MembersClientProps) {
  const canCreate = role === "admin" || role === "manager";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [includeLeft, setIncludeLeft] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (roleFilter) params.set("role", roleFilter);
  if (includeLeft) params.set("includeLeft", "1");
  const swrKey = `/api/members?${params}`;

  const { data: members = [], isLoading: loading } = useSWR<MemberListItem[]>(swrKey);

  return (
    <div className="space-y-4">
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
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeLeft}
            onChange={(e) => setIncludeLeft(e.target.checked)}
            className="rounded border-slate-300"
          />
          退社メンバーも表示
        </label>
      </div>

      {/* Member table */}
      {loading ? (
        <TablePageSkeleton rows={6} cols={4} />
      ) : members.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-500">
          該当するメンバーが見つかりません
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">名前</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">ステータス</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">ロール</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-500">メール</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {members.map((m) => (
                <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${m.leftAt ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/members/${m.id}`}
                      prefetch={false}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {m.name}
                    </Link>
                    {m.leftAt && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-500">
                        退社
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {statusLabel[m.status] ?? m.status}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {roleLabel[m.role] ?? m.role}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{m.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
