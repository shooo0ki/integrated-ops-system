// ─── 締め管理の型定義 ─────────────────────────────────────

export type ConfirmStatus = "not_sent" | "waiting" | "confirmed" | "forced";
export type InvoiceStatus = "none" | "generated" | "sent" | "approved" | "accounting_sent";

export interface ClosingRecord {
  memberId: string;
  memberName: string;
  contractType: string;
  salaryType: string;
  workDays: number;
  totalHours: number;
  missingDays: number;
  estimatedAmount: number;
  confirmStatus: ConfirmStatus;
  invoiceStatus: InvoiceStatus;
  hourlyRate: number | null;
  salaryAmount: number;
}

export interface InvoiceItem {
  id: string;
  name: string;
  amount: number;
  taxable: boolean;
  sortOrder: number;
}

export interface Invoice {
  id: string;
  memberId: string;
  memberName: string;
  salaryType: string;
  invoiceNumber: string;
  targetMonth: string;
  workHoursTotal: number;
  unitPrice: number;
  amountExclTax: number;
  expenseAmount?: number;
  amountInclTax: number;
  status: string;
  issuedAt: string;
  items: InvoiceItem[];
}

export interface LineItem {
  id: string;
  name: string;
  amount: number;
}

export interface ExpenseItem {
  id: string;
  projectId: string;
  description: string;
  amount: number;
}

export interface MyProject {
  projectId: string;
  projectName: string;
}

export interface SelfReportRow {
  key: string;
  projectId: string | null;
  customLabel: string | null;
  displayName: string;
  reportedPercent: number;
}

export interface SelfReportItem {
  id: string;
  projectId: string | null;
  projectName: string | null;
  customLabel: string | null;
  reportedPercent: number;
  reportedHours: number | null;
  submittedAt: string | null;
}
