import { readFileSync } from "fs";
import { join } from "path";
import { jsPDF } from "jspdf";

export interface InvoicePdfInput {
  invoiceNumber: string;
  targetMonth: string;
  issuerName: string;
  items: { name: string; amount: number; taxable?: boolean }[];
  note?: string | null;
  memberInfo?: {
    address?: string | null;
    bankName?: string | null;
    bankBranch?: string | null;
    bankAccountNumber?: string | null;
    bankAccountHolder?: string | null;
  } | null;
}

const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

let fontBase64: string | null = null;

function ensureFont(doc: jsPDF) {
  if (!fontBase64) {
    // Vercel Serverless では __dirname が使えない場合がある
    const candidates = [
      join(process.cwd(), "src/backend/fonts/NotoSansJP-Regular.ttf"),
      join(__dirname, "fonts/NotoSansJP-Regular.ttf"),
      join(__dirname, "../src/backend/fonts/NotoSansJP-Regular.ttf"),
    ];
    for (const p of candidates) {
      try {
        fontBase64 = readFileSync(p).toString("base64");
        break;
      } catch {
        continue;
      }
    }
    if (!fontBase64) throw new Error("Japanese font file not found");
  }
  doc.addFileToVFS("NotoSansJP-Regular.ttf", fontBase64);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
  doc.setFont("NotoSansJP");
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const { invoiceNumber, targetMonth, issuerName, items, note, memberInfo } = input;

  const taxableItems = items.filter((i) => i.taxable !== false);
  const nonTaxableItems = items.filter((i) => i.taxable === false);
  const taxableTotal = taxableItems.reduce((s, i) => s + i.amount, 0);
  const nonTaxableTotal = nonTaxableItems.reduce((s, i) => s + i.amount, 0);
  const tax = Math.round(taxableTotal * 0.1);
  const amountInclTax = taxableTotal + tax + nonTaxableTotal;

  const [yr, mo] = targetMonth.split("-");
  const monthLabel = `${yr}年${mo}月`;
  const issuedDate = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  ensureFont(doc);

  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 25;

  // ── タイトル ─────────────────────────────────────
  doc.setFontSize(18);
  doc.text("請　求　書", pageW / 2, y, { align: "center" });
  y += 12;

  // ── 請求書番号・発行日 ───────────────────────────
  doc.setFontSize(9);
  doc.text(`請求書番号: ${invoiceNumber}`, marginL, y);
  doc.text(`発行日: ${issuedDate}`, pageW - marginR, y, { align: "right" });
  y += 7;

  // ── 宛先・件名 ───────────────────────────────────
  doc.setFontSize(10);
  doc.text("請求先: 株式会社SALT2", marginL, y);
  y += 6;
  doc.text(`件名: ${monthLabel}分 業務委託費`, marginL, y);
  y += 10;

  // ── 合計金額（目立たせる）─────────────────────────
  doc.setFillColor(219, 234, 254); // blue-100
  doc.rect(marginL, y - 5, contentW, 10, "F");
  doc.setFontSize(12);
  doc.text(
    `ご請求金額: ${fmt(amountInclTax)}（税込）`,
    pageW / 2,
    y + 1,
    { align: "center" }
  );
  y += 12;

  // ── テーブルヘッダー ─────────────────────────────
  const colItem = marginL;
  const colAmount = pageW - marginR;

  doc.setFillColor(226, 232, 240); // slate-200
  doc.rect(marginL, y - 4, contentW, 7, "F");
  doc.setFontSize(9);
  doc.text("項目", colItem + 2, y);
  doc.text("金額", colAmount - 2, y, { align: "right" });
  y += 6;

  doc.setFontSize(9);

  // ── 稼働分（課税対象）────────────────────────────
  if (taxableItems.length > 0) {
    doc.setTextColor(30, 64, 175); // blue-800
    doc.text("【稼働分（課税対象）】", colItem + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 5;

    for (const item of taxableItems) {
      doc.text(item.name, colItem + 4, y);
      doc.text(fmt(item.amount), colAmount - 2, y, { align: "right" });
      y += 5;
    }

    // 小計
    doc.setDrawColor(200, 200, 200);
    doc.line(marginL, y - 1, pageW - marginR, y - 1);
    doc.text("稼働小計（税抜）", colItem + 4, y + 3);
    doc.text(fmt(taxableTotal), colAmount - 2, y + 3, { align: "right" });
    y += 5;
    doc.text("消費税（10%）", colItem + 4, y + 3);
    doc.text(fmt(tax), colAmount - 2, y + 3, { align: "right" });
    y += 8;
  }

  // ── 経費・交通費（非課税）────────────────────────
  if (nonTaxableItems.length > 0) {
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.text("【経費・交通費（非課税）】", colItem + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 5;

    for (const item of nonTaxableItems) {
      doc.text(item.name, colItem + 4, y);
      doc.text(fmt(item.amount), colAmount - 2, y, { align: "right" });
      y += 5;
    }

    doc.line(marginL, y - 1, pageW - marginR, y - 1);
    doc.text("経費小計", colItem + 4, y + 3);
    doc.text(fmt(nonTaxableTotal), colAmount - 2, y + 3, { align: "right" });
    y += 8;
  }

  // ── 合計行 ───────────────────────────────────────
  doc.setDrawColor(100, 100, 100);
  doc.line(marginL, y, pageW - marginR, y);
  y += 5;
  doc.setFillColor(219, 234, 254);
  doc.rect(marginL, y - 4, contentW, 8, "F");
  doc.setFontSize(11);
  const totalLabel = nonTaxableItems.length > 0 ? "合計（税込＋経費）" : "合計（税込）";
  doc.text(totalLabel, colItem + 2, y + 1);
  doc.text(fmt(amountInclTax), colAmount - 2, y + 1, { align: "right" });
  y += 14;

  // ── 備考 ─────────────────────────────────────────
  doc.setFontSize(9);
  if (note) {
    doc.text(`備考: ${note}`, marginL, y);
    y += 6;
  }

  // ── 発行者情報 ───────────────────────────────────
  doc.text(`発行者: ${issuerName}`, marginL, y);
  y += 5;

  doc.setTextColor(100, 116, 139); // slate-500
  if (memberInfo?.address) {
    doc.text(`住所: ${memberInfo.address}`, marginL, y);
    y += 5;
  }
  if (memberInfo?.bankName || memberInfo?.bankAccountNumber) {
    const bankLine = [
      memberInfo?.bankName,
      memberInfo?.bankBranch,
      memberInfo?.bankAccountNumber ? `口座番号: ${memberInfo.bankAccountNumber}` : null,
      memberInfo?.bankAccountHolder ? `（${memberInfo.bankAccountHolder}）` : null,
    ]
      .filter(Boolean)
      .join(" ");
    doc.text(`振込先: ${bankLine}`, marginL, y);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
