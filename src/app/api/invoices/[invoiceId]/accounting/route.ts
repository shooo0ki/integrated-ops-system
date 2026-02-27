import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateInvoiceExcel } from "@/lib/invoice-excel";
import { sendEmail } from "@/lib/email";

// PATCH /api/invoices/[invoiceId]/accounting
// admin/manager: LayerX へメール送付 → status を confirmed に更新
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      member: {
        select: {
          name: true,
          address: true,
          bankName: true,
          bankBranch: true,
          bankAccountNumber: true,
          bankAccountHolder: true,
        },
      },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "請求書が見つかりません" }, { status: 404 });
  }

  // ── Excel 再生成 ───────────────────────────────────────
  const buffer = await generateInvoiceExcel({
    invoiceNumber: invoice.invoiceNumber,
    targetMonth: invoice.targetMonth,
    issuerName: invoice.member.name,
    items: invoice.items.map((it) => ({ name: it.name, amount: it.amount })),
    memberInfo: {
      address: invoice.member.address,
      bankName: invoice.member.bankName,
      bankBranch: invoice.member.bankBranch,
      bankAccountNumber: invoice.member.bankAccountNumber,
      bankAccountHolder: invoice.member.bankAccountHolder,
    },
  });

  // ── LayerX へメール送信 ────────────────────────────────
  const layerxEmail = process.env.LAYERX_EMAIL;
  if (layerxEmail) {
    const [yr, mo] = invoice.targetMonth.split("-");
    await sendEmail({
      to: layerxEmail,
      subject: `【請求書】${invoice.member.name} ${yr}年${mo}月分 ${invoice.invoiceNumber}`,
      text: [
        `${invoice.member.name} さんの ${yr}年${mo}月分 請求書を送付します。`,
        "",
        `請求書番号: ${invoice.invoiceNumber}`,
        `金額（税抜）: ¥${invoice.amountExclTax.toLocaleString()}`,
        `金額（税込）: ¥${invoice.amountInclTax.toLocaleString()}`,
      ].join("\n"),
      attachment: {
        filename: `invoice-${invoice.targetMonth}-${invoice.invoiceNumber}.xlsx`,
        content: buffer,
      },
    });
  }

  // ── ステータス更新 ─────────────────────────────────────
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "confirmed" },
  });

  return NextResponse.json({ ok: true });
}
