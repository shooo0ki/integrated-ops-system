"use client";

import { useAuth } from "@/lib/auth-context";

type Role = "admin" | "manager" | "member";

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "管理者" },
  { value: "manager", label: "マネージャー" },
  { value: "member", label: "メンバー" },
];

export function RoleSwitcher() {
  const { role, switchRole } = useAuth();

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
      <span className="font-medium">デモ:</span>
      <select
        value={role}
        onChange={(e) => switchRole(e.target.value as Role)}
        className="bg-transparent text-xs font-medium text-amber-700 focus:outline-none cursor-pointer"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}
