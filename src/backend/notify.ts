import { prisma } from "@/backend/db";

interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  linkUrl?: string;
}

/** admin/manager 全員にアプリ内通知を作成 */
export async function notifyAdmins(input: NotifyInput): Promise<void> {
  const admins = await prisma.userAccount.findMany({
    where: { role: { in: ["admin", "manager"] } },
    select: { memberId: true },
  });

  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      memberId: a.memberId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
    })),
  });
}
