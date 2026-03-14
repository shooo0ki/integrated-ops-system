"use client";

import { useAuth } from "@/frontend/contexts/auth-context";
import { AdminClosingView } from "@/frontend/components/domain/closing/admin-closing-view";
import { MemberBillingView } from "@/frontend/components/domain/closing/member-billing-view";
import { InlineSkeleton } from "@/frontend/components/common/skeleton";

export default function ClosingPage() {
  const { role, memberId, isLoading } = useAuth();

  if (isLoading) {
    return (
      <InlineSkeleton />
    );
  }

  if (role === "admin" || role === "manager") return <AdminClosingView />;
  return <MemberBillingView memberId={memberId ?? ""} />;
}
