export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";

/**
 * Better Auth セッションに含まれない業務固有情報 (role, memberId) を返す。
 * auth-context.tsx から呼ばれる。
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }
  return NextResponse.json({
    memberId: user.memberId,
    role: user.role,
  });
}
