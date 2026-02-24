import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function unauthorized() {
  return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "ログインが必要です" } }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "権限がありません" } }, { status: 403 });
}

// GET /api/system-configs — returns all configs as { key: value } map
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const configs = await prisma.systemConfig.findMany({ orderBy: { key: "asc" } });

  const result: Record<string, string> = {};
  for (const c of configs) {
    result[c.key] = c.isSecret ? "" : c.value;
  }

  return NextResponse.json(result);
}

// PUT /api/system-configs
// Body: { configs: [{ key: string; value: string }] }
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden();

  const body = await req.json().catch(() => null);
  const configs: { key: string; value: string }[] = body?.configs ?? [];

  if (!Array.isArray(configs) || configs.length === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "configs は配列で必須です" } },
      { status: 400 }
    );
  }

  // 秘匿キーの判定
  const secretKeys = ["slack_webhook_url"];

  for (const { key, value } of configs) {
    if (!key || value === undefined) continue;
    const isSecret = secretKeys.includes(key);
    await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, isSecret, updatedBy: user.id },
      update: { value, updatedBy: user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
