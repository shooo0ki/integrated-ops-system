export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/backend/auth";
import { prisma } from "@/backend/db";
import { generateInvoicePdf } from "@/backend/invoice-pdf";
import { sendEmail } from "@/backend/email";
import { unauthorized, forbidden, apiError } from "@/backend/api-response";

// PATCH /api/invoices/[invoiceId]/accounting
// admin/manager: LayerX へメール送付 → status を confirmed に更新
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "admin" && user.role !== "manager") {
    return forbidden();
  }

  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      member: {
        select: {
          name: true,
          phone: true,
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
    return apiError("NOT_FOUND", "請求書が見つかりません", 404);
  }

  // ── PDF 生成 ──────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      targetMonth: invoice.targetMonth,
      issuerName: invoice.member.name,
      issuedAt: invoice.issuedAt.toISOString().slice(0, 10),
      unitPrice: invoice.unitPrice,
      workHoursTotal: Number(invoice.workHoursTotal),
      items: invoice.items.map((it) => ({ name: it.name, amount: it.amount, taxable: it.taxable })),
      memberInfo: {
        phone: invoice.member.phone,
        address: invoice.member.address,
        bankName: invoice.member.bankName,
        bankBranch: invoice.member.bankBranch,
        bankAccountNumber: invoice.member.bankAccountNumber,
        bankAccountHolder: invoice.member.bankAccountHolder,
      },
    });
  } catch (e) {
    console.error("PDF generation failed:", e);
    return apiError("INTERNAL_ERROR", "PDF生成に失敗しました", 500);
  }

  // ── LayerX へメール送信 ────────────────────────────────
  const layerxEmail = process.env.LAYERX_EMAIL;
  if (layerxEmail) {
    try {
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
          filename: `invoice-${invoice.targetMonth}-${invoice.invoiceNumber}.pdf`,
          content: buffer,
        },
      });
    } catch (e) {
      console.error("Email sending failed:", e);
      return apiError("INTERNAL_ERROR", "メール送信に失敗しました", 500);
    }
  }

  // ── ステータス更新 + 監査ログ ────────────────────────────
  const ip = _req.headers.get("x-forwarded-for") ?? _req.headers.get("x-real-ip") ?? "127.0.0.1";
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "confirmed" },
    });

    await tx.auditLog.create({
      data: {
        operatorId: user.id,
        targetTable: "invoices",
        targetId: invoiceId,
        action: "UPDATE",
        beforeData: { status: invoice.status },
        afterData: { status: "confirmed" },
        ipAddress: ip,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
