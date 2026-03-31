import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface InvoicePdfInput {
  invoiceNumber: string;
  targetMonth: string;
  issuerName: string;
  issuedAt: string; // YYYY-MM-DD
  unitPrice: number;
  workHoursTotal: number;
  items: { name: string; amount: number; taxable?: boolean }[];
  note?: string | null;
  memberInfo?: {
    phone?: string | null;
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
  const { invoiceNumber, targetMonth, issuerName, issuedAt, unitPrice, workHoursTotal, items, note, memberInfo } = input;

  const taxableItems = items.filter((i) => i.taxable !== false);
  const nonTaxableItems = items.filter((i) => i.taxable === false);
  const taxableTotal = taxableItems.reduce((s, i) => s + i.amount, 0);
  const nonTaxableTotal = nonTaxableItems.reduce((s, i) => s + i.amount, 0);
  const tax = Math.round(taxableTotal * 0.1);
  const amountInclTax = taxableTotal + tax + nonTaxableTotal;

  const [yr, mo] = targetMonth.split("-");
  const monthLabel = `${Number(mo)}月分`;

  // 発行日
  const [iyr, imo, iday] = issuedAt.split("-");
  const issuedDateStr = `${Number(imo)}/${Number(iday)}/${iyr}`;

  // 支払期限: 翌月25日
  const nextMonth = Number(mo) === 12 ? 1 : Number(mo) + 1;
  const nextYear = Number(mo) === 12 ? Number(yr) + 1 : Number(yr);
  const paymentDeadline = `${nextMonth}/25/${nextYear}`;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const jpFontData = loadFontBytes();
  const jpFont = await pdfDoc.embedFont(jpFontData);

  // A4: 595.28 x 841.89 pt
  const page = pdfDoc.addPage([595.28, 841.89]);
  const pageW = 595.28;
  const marginL = 40;
  const marginR = 40;
  const contentW = pageW - marginL - marginR;
  let y = 790;

  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const darkBg = rgb(0.25, 0.25, 0.25);
  const headerBg = rgb(0.35, 0.35, 0.35);

  function text(s: string, x: number, yPos: number, size: number, opts?: { color?: typeof black; align?: "right" | "center" }) {
    const color = opts?.color ?? black;
    const w = jpFont.widthOfTextAtSize(s, size);
    let drawX = x;
    if (opts?.align === "right") drawX = x - w;
    else if (opts?.align === "center") drawX = x - w / 2;
    page.drawText(s, { x: drawX, y: yPos, size, font: jpFont, color });
  }

  function rect(x: number, yPos: number, w: number, h: number, color: typeof black) {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  }

  function line(x1: number, yPos: number, x2: number, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color: black });
  }

  function lineV(x: number, y1: number, y2: number, thickness = 0.5) {
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color: black });
  }

  function border(x: number, yPos: number, w: number, h: number) {
    page.drawRectangle({ x, y: yPos, width: w, height: h, borderColor: black, borderWidth: 0.5, color: rgb(1, 1, 1) });
  }

  const colRight = pageW - marginR;

  // ══════════════════════════════════════════════════
  // タイトル: 請 求 書 (下線付き)
  // ══════════════════════════════════════════════════
  text("請 求 書", pageW / 2, y, 20, { align: "center" });
  y -= 4;
  const titleW = jpFont.widthOfTextAtSize("請 求 書", 20);
  line(pageW / 2 - titleW / 2, y, pageW / 2 + titleW / 2, 1.5);
  y -= 22;

  // ══════════════════════════════════════════════════
  // 左: 株式会社SALT2 御中 / 右: No, 請求日
  // ══════════════════════════════════════════════════
  text("株式会社SALT2 御中", marginL, y, 11);
  text(`No`, colRight - 80, y, 9);
  text(invoiceNumber, colRight, y, 9, { align: "right" });
  y -= 16;
  text(`請求日`, colRight - 80, y, 9);
  text(issuedDateStr, colRight, y, 9, { align: "right" });
  y -= 28;

  // ══════════════════════════════════════════════════
  // 左側: 件名・支払期限・振込先テーブル / 右側: 個人名・住所・TEL
  // ══════════════════════════════════════════════════
  text("下記のとおり、御請求申し上げます。", marginL, y, 9);
  y -= 6;

  const infoY = y;
  const leftTableX = marginL;
  const leftLabelW = 60;
  const leftValueW = 200;
  const leftTableW = leftLabelW + leftValueW;
  const rowH = 18;

  // 振込先テキスト
  const bankLine = [
    memberInfo?.bankName,
    memberInfo?.bankBranch ? `　${memberInfo.bankBranch}` : null,
  ].filter(Boolean).join("");

  const leftRows = [
    { label: "件名", value: `開発業務委託${monthLabel}` },
    { label: "支払期限", value: paymentDeadline },
    { label: "振込先", value: bankLine || "—" },
  ];

  for (let i = 0; i < leftRows.length; i++) {
    const rowY = infoY - i * rowH;
    // Label cell (dark bg)
    rect(leftTableX, rowY - rowH, leftLabelW, rowH, darkBg);
    text(leftRows[i].label, leftTableX + leftLabelW / 2, rowY - rowH + 5, 9, { align: "center", color: white });
    // Value cell (border)
    border(leftTableX + leftLabelW, rowY - rowH, leftValueW, rowH);
    text(leftRows[i].value, leftTableX + leftLabelW + 8, rowY - rowH + 5, 9);
  }
  // Outer border
  border(leftTableX, infoY - leftRows.length * rowH, leftTableW, leftRows.length * rowH);

  // 右側: 個人情報
  const rightX = 370;
  let rightY = infoY;
  text(`個人名：${issuerName}`, rightX, rightY - 13, 9);
  rightY -= rowH;
  text(`住所：${memberInfo?.address ?? ""}`, rightX, rightY - 13, 9);
  rightY -= rowH;
  text(`TEL：${memberInfo?.phone ?? ""}`, rightX, rightY - 13, 9);

  y = infoY - leftRows.length * rowH - 20;

  // ══════════════════════════════════════════════════
  // 合計金額ボックス
  // ══════════════════════════════════════════════════
  const totalBoxX = marginL;
  const totalLabelW = 60;
  const totalValueW = 200;
  const totalBoxH = 28;

  rect(totalBoxX, y - totalBoxH, totalLabelW, totalBoxH, darkBg);
  text("合計", totalBoxX + totalLabelW / 2, y - totalBoxH + 8, 10, { align: "center", color: white });
  border(totalBoxX + totalLabelW, y - totalBoxH, totalValueW, totalBoxH);
  text(`${fmt(amountInclTax)}(税込)`, totalBoxX + totalLabelW + totalValueW / 2, y - totalBoxH + 8, 14, { align: "center" });
  border(totalBoxX, y - totalBoxH, totalLabelW + totalValueW, totalBoxH);

  y -= totalBoxH + 24;

  // ══════════════════════════════════════════════════
  // 明細テーブル: 摘要 | 時給 | 時間 | 金額
  // ══════════════════════════════════════════════════
  const tableX = marginL;
  const col1W = 260; // 摘要
  const col2W = 75;  // 時給
  const col3W = 75;  // 時間
  const col4W = contentW - col1W - col2W - col3W; // 金額
  const tableW = contentW;
  const tRowH = 20;

  // ヘッダー
  rect(tableX, y - tRowH, tableW, tRowH, headerBg);
  const hdrY = y - tRowH + 6;
  text("摘要", tableX + col1W / 2, hdrY, 9, { align: "center", color: white });
  text("時給", tableX + col1W + col2W / 2, hdrY, 9, { align: "center", color: white });
  text("時間", tableX + col1W + col2W + col3W / 2, hdrY, 9, { align: "center", color: white });
  text("金額", tableX + col1W + col2W + col3W + col4W / 2, hdrY, 9, { align: "center", color: white });
  // header border
  border(tableX, y - tRowH, tableW, tRowH);
  y -= tRowH;

  // 稼働行（課税対象）
  for (const item of taxableItems) {
    border(tableX, y - tRowH, col1W, tRowH);
    border(tableX + col1W, y - tRowH, col2W, tRowH);
    border(tableX + col1W + col2W, y - tRowH, col3W, tRowH);
    border(tableX + col1W + col2W + col3W, y - tRowH, col4W, tRowH);
    const cellY = y - tRowH + 6;
    text(item.name, tableX + 8, cellY, 8);
    // 最初の稼働行に時給・時間を表示
    if (item === taxableItems[0] && unitPrice > 0) {
      text(fmt(unitPrice), tableX + col1W + col2W - 8, cellY, 8, { align: "right" });
      text(workHoursTotal > 0 ? String(workHoursTotal) : "", tableX + col1W + col2W + col3W - 8, cellY, 8, { align: "right" });
    }
    text(fmt(item.amount), tableX + col1W + col2W + col3W + col4W - 8, cellY, 8, { align: "right" });
    y -= tRowH;
  }

  // 経費行（非課税）
  for (const item of nonTaxableItems) {
    border(tableX, y - tRowH, col1W, tRowH);
    border(tableX + col1W, y - tRowH, col2W, tRowH);
    border(tableX + col1W + col2W, y - tRowH, col3W, tRowH);
    border(tableX + col1W + col2W + col3W, y - tRowH, col4W, tRowH);
    const cellY = y - tRowH + 6;
    text(item.name, tableX + 8, cellY, 8);
    text(fmt(item.amount), tableX + col1W + col2W + col3W + col4W - 8, cellY, 8, { align: "right" });
    y -= tRowH;
  }

  // 空行（最低10行表示）
  const totalRows = taxableItems.length + nonTaxableItems.length;
  const emptyRows = Math.max(0, 10 - totalRows);
  for (let i = 0; i < emptyRows; i++) {
    border(tableX, y - tRowH, col1W, tRowH);
    border(tableX + col1W, y - tRowH, col2W, tRowH);
    border(tableX + col1W + col2W, y - tRowH, col3W, tRowH);
    border(tableX + col1W + col2W + col3W, y - tRowH, col4W, tRowH);
    y -= tRowH;
  }

  y -= 12;

  // ══════════════════════════════════════════════════
  // 小計・消費税・合計
  // ══════════════════════════════════════════════════
  const sumLabelX = tableX + col1W + col2W;
  const sumValueX = tableX + tableW - 8;
  const sumW = col3W + col4W;

  // 小計
  border(sumLabelX, y - tRowH, col3W, tRowH);
  border(sumLabelX + col3W, y - tRowH, col4W, tRowH);
  text("小計", sumLabelX + col3W / 2, y - tRowH + 6, 9, { align: "center" });
  text(fmt(taxableTotal + nonTaxableTotal), sumValueX, y - tRowH + 6, 9, { align: "right" });
  y -= tRowH;

  // 消費税
  border(sumLabelX, y - tRowH, col3W, tRowH);
  border(sumLabelX + col3W, y - tRowH, col4W, tRowH);
  text("消費税(10%)", sumLabelX + col3W / 2, y - tRowH + 6, 8, { align: "center" });
  text(fmt(tax), sumValueX, y - tRowH + 6, 9, { align: "right" });
  y -= tRowH;

  // 合計
  rect(sumLabelX, y - tRowH, col3W, tRowH, darkBg);
  border(sumLabelX + col3W, y - tRowH, col4W, tRowH);
  text("合計", sumLabelX + col3W / 2, y - tRowH + 6, 9, { align: "center", color: white });
  text(fmt(amountInclTax), sumValueX, y - tRowH + 6, 9, { align: "right" });
  y -= tRowH + 16;

  // ── 備考
  if (note) {
    text(`備考: ${note}`, marginL, y, 9);
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
