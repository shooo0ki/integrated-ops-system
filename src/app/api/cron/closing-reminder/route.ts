export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/backend/db";
import { sendSlackDM, getSlackUserId } from "@/backend/slack";
import { sendEmail } from "@/backend/email";
import { unauthorized } from "@/backend/api-response";

// GET /api/cron/closing-reminder
// Vercel Cron: 毎月25日 10:00 JST (01:00 UTC)
// 請求書・工数申告未提出のメンバーにリマインド送信
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  // 今月の targetMonth（YYYY-MM）
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const targetMonth = `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, "0")}`;

  // closingReminder が有効なアクティブメンバー
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      leftAt: null,
      OR: [
        { notificationSetting: { closingReminder: true } },
        { notificationSetting: null },
      ],
    },
    select: {
      id: true,
      name: true,
      userAccount: { select: { email: true } },
    },
  });

  // 提出済みの請求書・工数申告を取得
  const [invoices, selfReports] = await Promise.all([
    prisma.invoice.findMany({
      where: { targetMonth, status: { not: "unsent" } },
      select: { memberId: true },
    }),
    prisma.monthlySelfReport.findMany({
      where: { targetMonth, submittedAt: { not: null } },
      select: { memberId: true },
      distinct: ["memberId"],
    }),
  ]);

  const invoiceDone = new Set(invoices.map((i) => i.memberId));
  const selfReportDone = new Set(selfReports.map((r) => r.memberId));

  const needsReminder = members
    .map((m) => ({
      ...m,
      missingInvoice: !invoiceDone.has(m.id),
      missingSelfReport: !selfReportDone.has(m.id),
    }))
    .filter((m) => m.missingInvoice || m.missingSelfReport);

  if (needsReminder.length === 0) {
    return NextResponse.json({ ok: true, message: "全員提出済み" });
  }

  await Promise.all(
    needsReminder.map(async (m) => {
      const missing: string[] = [];
      if (m.missingSelfReport) missing.push("工数申告");
      if (m.missingInvoice) missing.push("請求書");
      const missingText = missing.join("・");

      const email = m.userAccount?.email;

      // Slack DM
      if (email) {
        const slackUserId = await getSlackUserId(email);
        if (slackUserId) {
          await sendSlackDM(
            slackUserId,
            `📋 ${m.name}さん、${targetMonth}の${missingText}が未提出です。月末までに提出をお願いします。`
          );
        }
      }

      // メール
      if (email) {
        await sendEmail({
          to: email,
          subject: `【締めリマインド】${targetMonth}の${missingText}が未提出です`,
          text: [
            `${m.name}さん`,
            "",
            `${targetMonth}の以下が未提出です:`,
            ...missing.map((t) => `  - ${t}`),
            "",
            "月末までに提出をお願いします。",
          ].join("\n"),
        });
      }
    })
  );

  return NextResponse.json({ ok: true, notified: needsReminder.length });
}
