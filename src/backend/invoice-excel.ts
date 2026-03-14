import ExcelJS from "exceljs";

export interface InvoiceExcelInput {
  invoiceNumber: string;
  targetMonth: string;       // YYYY-MM
  issuerName: string;
  items: { name: string; amount: number; taxable?: boolean; linkedProjectId?: string }[];
  note?: string | null;
  memberInfo?: {
    address?: string | null;
    bankName?: string | null;
    bankBranch?: string | null;
    bankAccountNumber?: string | null;
    bankAccountHolder?: string | null;
  } | null;
}

export async function generateInvoiceExcel(input: InvoiceExcelInput): Promise<Buffer> {
  const { invoiceNumber, targetMonth, issuerName, items, note, memberInfo } = input;

  const taxableItems = items.filter((i) => i.taxable !== false);
  const nonTaxableItems = items.filter((i) => i.taxable === false);
  const taxableTotal = taxableItems.reduce((s, i) => s + i.amount, 0);
  const nonTaxableTotal = nonTaxableItems.reduce((s, i) => s + i.amount, 0);
  const tax = Math.round(taxableTotal * 0.1);
  const amountInclTax = taxableTotal + tax + nonTaxableTotal;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("請求書");

  sheet.getColumn("A").width = 36;
  sheet.getColumn("B").width = 18;

  const issuedDate = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [yr, mo] = targetMonth.split("-");
  const monthLabel = `${yr}年${mo}月`;

  sheet.mergeCells("A1:B1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "請　求　書";
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center" };

  sheet.getCell("A2").value = `請求書番号: ${invoiceNumber}`;
  sheet.getCell("B2").value = `発行日: ${issuedDate}`;
  sheet.getCell("B2").alignment = { horizontal: "right" };

  sheet.getCell("A3").value = "請求先: 株式会社SALT2";
  sheet.getCell("A4").value = `件名: ${monthLabel}分 業務委託費`;

  const headerRow = sheet.getRow(6);
  headerRow.getCell("A").value = "項目";
  headerRow.getCell("B").value = "金額";
  headerRow.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = { bottom: { style: "thin" } };
  });
  headerRow.getCell("B").alignment = { horizontal: "right" };

  let rowNum = 7;

  // ── 【稼働分（課税対象）】 ────────────────────────────
  if (taxableItems.length > 0) {
    const sectionRow = sheet.getRow(rowNum);
    sectionRow.getCell("A").value = "【稼働分（課税対象）】";
    sectionRow.getCell("A").font = { bold: true, color: { argb: "FF1E40AF" } };
    rowNum++;

    for (const item of taxableItems) {
      const row = sheet.getRow(rowNum);
      row.getCell("A").value = item.name;
      row.getCell("B").value = item.amount;
      row.getCell("B").numFmt = "¥#,##0";
      row.getCell("B").alignment = { horizontal: "right" };
      rowNum++;
    }

    const subtotalRow = sheet.getRow(rowNum);
    subtotalRow.getCell("A").value = "  稼働小計（税抜）";
    subtotalRow.getCell("A").font = { bold: true };
    subtotalRow.getCell("B").value = taxableTotal;
    subtotalRow.getCell("B").numFmt = "¥#,##0";
    subtotalRow.getCell("B").alignment = { horizontal: "right" };
    rowNum++;

    const taxRow = sheet.getRow(rowNum);
    taxRow.getCell("A").value = "  消費税（10%）";
    taxRow.getCell("B").value = tax;
    taxRow.getCell("B").numFmt = "¥#,##0";
    taxRow.getCell("B").alignment = { horizontal: "right" };
    rowNum++;
  }

  // ── 【経費・交通費（非課税）】 ─────────────────────────
  if (nonTaxableItems.length > 0) {
    rowNum++; // 空行

    const sectionRow = sheet.getRow(rowNum);
    sectionRow.getCell("A").value = "【経費・交通費（非課税）】";
    sectionRow.getCell("A").font = { bold: true, color: { argb: "FF065F46" } };
    rowNum++;

    for (const item of nonTaxableItems) {
      const row = sheet.getRow(rowNum);
      row.getCell("A").value = item.name;
      row.getCell("B").value = item.amount;
      row.getCell("B").numFmt = "¥#,##0";
      row.getCell("B").alignment = { horizontal: "right" };
      rowNum++;
    }

    const expSubtotalRow = sheet.getRow(rowNum);
    expSubtotalRow.getCell("A").value = "  経費小計";
    expSubtotalRow.getCell("A").font = { bold: true };
    expSubtotalRow.getCell("B").value = nonTaxableTotal;
    expSubtotalRow.getCell("B").numFmt = "¥#,##0";
    expSubtotalRow.getCell("B").alignment = { horizontal: "right" };
    rowNum++;
  }

  // ── 合計 ──────────────────────────────────────────────
  rowNum++; // 空行

  const totalRow = sheet.getRow(rowNum);
  totalRow.getCell("A").value = nonTaxableItems.length > 0 ? "合計（税込＋経費）" : "合計（税込）";
  totalRow.getCell("B").value = amountInclTax;
  totalRow.getCell("B").numFmt = "¥#,##0";
  totalRow.getCell("B").alignment = { horizontal: "right" };
  totalRow.eachCell((cell: ExcelJS.Cell) => { cell.font = { bold: true }; });
  totalRow.getCell("A").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  totalRow.getCell("B").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  rowNum++;

  rowNum++; // 空行

  if (note) {
    sheet.getRow(rowNum).getCell("A").value = `備考: ${note}`;
    rowNum++;
  }

  sheet.getRow(rowNum).getCell("A").value = `発行者: ${issuerName}`;
  rowNum++;

  if (memberInfo?.address) {
    sheet.getRow(rowNum).getCell("A").value = `住所: ${memberInfo.address}`;
    sheet.getRow(rowNum).getCell("A").font = { color: { argb: "FF64748B" } };
    rowNum++;
  }

  if (memberInfo?.bankName || memberInfo?.bankAccountNumber) {
    const bankLine = [
      memberInfo.bankName,
      memberInfo.bankBranch,
      memberInfo.bankAccountNumber ? `口座番号: ${memberInfo.bankAccountNumber}` : null,
      memberInfo.bankAccountHolder ? `（${memberInfo.bankAccountHolder}）` : null,
    ].filter(Boolean).join(" ");
    sheet.getRow(rowNum).getCell("A").value = `振込先: ${bankLine}`;
    sheet.getRow(rowNum).getCell("A").font = { color: { argb: "FF64748B" } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
