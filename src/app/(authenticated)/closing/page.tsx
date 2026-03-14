"use client";

import { useAuth } from "@/contexts/auth-context";
import { AdminClosingView } from "@/components/domain/closing/admin-closing-view";
import { MemberBillingView } from "@/components/domain/closing/member-billing-view";

export default function ClosingPage() {
  const { role, memberId, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">読み込み中...</div>
    );
  }

  if (role === "admin" || role === "manager") return <AdminClosingView />;
  return <MemberBillingView memberId={memberId ?? ""} />;
}
