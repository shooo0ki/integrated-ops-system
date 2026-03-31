import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

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

let fontBytes: Uint8Array | null = null;

function loadFontBytes(): Uint8Array {
  if (fontBytes) return fontBytes;
  const candidates = [
    join(process.cwd(), "src/backend/fonts/NotoSansJP-Regular.ttf"),
    join(__dirname, "fonts/NotoSansJP-Regular.ttf"),
    join(__dirname, "../src/backend/fonts/NotoSansJP-Regular.ttf"),
  ];
  for (const p of candidates) {
    try {
      fontBytes = readFileSync(p);
      return fontBytes;
    } catch {
      continue;
    }
  }
  throw new Error("Japanese font file not found");
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

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const jpFontData = loadFontBytes();
  const jpFont = await pdfDoc.embedFont(jpFontData);

  // A4: 595.28 x 841.89 pt
  const page = pdfDoc.addPage([595.28, 841.89]);
  const pageW = 595.28;
  const marginL = 56; // ~20mm
  const marginR = 56;
  const contentW = pageW - marginL - marginR;
  let y = 800;

  const blue100 = rgb(219 / 255, 234 / 255, 254 / 255);
  const slate200 = rgb(226 / 255, 232 / 255, 240 / 255);
  const blue800 = rgb(30 / 255, 64 / 255, 175 / 255);
  const emerald800 = rgb(6 / 255, 95 / 255, 70 / 255);
  const slate500 = rgb(100 / 255, 116 / 255, 139 / 255);
  const black = rgb(0, 0, 0);
  const gray = rgb(200 / 255, 200 / 255, 200 / 255);
  const darkGray = rgb(100 / 255, 100 / 255, 100 / 255);

  function drawText(text: string, x: number, yPos: number, size: number, options?: { color?: typeof black; align?: "right" | "center" }) {
    const color = options?.color ?? black;
    const width = jpFont.widthOfTextAtSize(text, size);
    let drawX = x;
    if (options?.align === "right") drawX = x - width;
    else if (options?.align === "center") drawX = x - width / 2;
    page.drawText(text, { x: drawX, y: yPos, size, font: jpFont, color });
  }

  function drawRect(x: number, yPos: number, w: number, h: number, color: typeof black) {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  }

  function drawLine(x1: number, yPos: number, x2: number, color: typeof black) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness: 0.5, color });
  }

  const colRight = pageW - marginR;

  // ── タイトル
  drawText("請　求　書", pageW / 2, y, 18, { align: "center" });
  y -= 30;

  // ── 請求書番号・発行日
  drawText(`請求書番号: ${invoiceNumber}`, marginL, y, 9);
  drawText(`発行日: ${issuedDate}`, colRight, y, 9, { align: "right" });
  y -= 18;

  // ── 宛先・件名
  drawText("請求先: 株式会社SALT2", marginL, y, 10);
  y -= 16;
  drawText(`件名: ${monthLabel}分 業務委託費`, marginL, y, 10);
  y -= 24;

  // ── 合計金額（目立たせる）
  drawRect(marginL, y - 6, contentW, 24, blue100);
  drawText(`ご請求金額: ${fmt(amountInclTax)}（税込）`, pageW / 2, y, 12, { align: "center" });
  y -= 30;

  // ── テーブルヘッダー
  drawRect(marginL, y - 4, contentW, 18, slate200);
  drawText("項目", marginL + 6, y, 9);
  drawText("金額", colRight - 6, y, 9, { align: "right" });
  y -= 18;

  // ── 稼働分（課税対象）
  if (taxableItems.length > 0) {
    drawText("【稼働分（課税対象）】", marginL + 6, y, 9, { color: blue800 });
    y -= 14;

    for (const item of taxableItems) {
      drawText(item.name, marginL + 12, y, 9);
      drawText(fmt(item.amount), colRight - 6, y, 9, { align: "right" });
      y -= 14;
    }

    drawLine(marginL, y + 4, colRight, gray);
    drawText("稼働小計（税抜）", marginL + 12, y, 9);
    drawText(fmt(taxableTotal), colRight - 6, y, 9, { align: "right" });
    y -= 14;
    drawText("消費税（10%）", marginL + 12, y, 9);
    drawText(fmt(tax), colRight - 6, y, 9, { align: "right" });
    y -= 20;
  }

  // ── 経費・交通費（非課税）
  if (nonTaxableItems.length > 0) {
    drawText("【経費・交通費（非課税）】", marginL + 6, y, 9, { color: emerald800 });
    y -= 14;

    for (const item of nonTaxableItems) {
      drawText(item.name, marginL + 12, y, 9);
      drawText(fmt(item.amount), colRight - 6, y, 9, { align: "right" });
      y -= 14;
    }

    drawLine(marginL, y + 4, colRight, gray);
    drawText("経費小計", marginL + 12, y, 9);
    drawText(fmt(nonTaxableTotal), colRight - 6, y, 9, { align: "right" });
    y -= 20;
  }

  // ── 合計行
  drawLine(marginL, y + 4, colRight, darkGray);
  y -= 4;
  drawRect(marginL, y - 6, contentW, 22, blue100);
  const totalLabel = nonTaxableItems.length > 0 ? "合計（税込＋経費）" : "合計（税込）";
  drawText(totalLabel, marginL + 6, y, 11);
  drawText(fmt(amountInclTax), colRight - 6, y, 11, { align: "right" });
  y -= 34;

  // ── 備考
  if (note) {
    drawText(`備考: ${note}`, marginL, y, 9);
    y -= 16;
  }

  // ── 発行者情報
  drawText(`発行者: ${issuerName}`, marginL, y, 9);
  y -= 14;

  if (memberInfo?.address) {
    drawText(`住所: ${memberInfo.address}`, marginL, y, 9, { color: slate500 });
    y -= 14;
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
    drawText(`振込先: ${bankLine}`, marginL, y, 9, { color: slate500 });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
