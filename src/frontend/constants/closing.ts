import type { ConfirmStatus } from "@/shared/types/closing";
import { formatCurrency, buildMonths } from "@/shared/utils";

export const confirmVariant: Record<ConfirmStatus, "default" | "warning" | "success" | "info" | "danger"> = {
  not_sent: "default", waiting: "warning", confirmed: "success", forced: "info",
};

export const confirmLabel: Record<ConfirmStatus, string> = {
  not_sent: "未通知", waiting: "確認中", confirmed: "確認済", forced: "強制確定",
};

export const receiptConfig: Record<string, { label: string; variant: "default" | "info" | "warning" | "success" }> = {
  none:            { label: "未提出",           variant: "default" },
  generated:       { label: "未提出",           variant: "default" },
  sent:            { label: "提出済み（承認待ち）", variant: "warning" },
  approved:        { label: "確認済み",         variant: "success" },
  accounting_sent: { label: "LayerX送付済み",   variant: "info" },
};

export const NON_PROJECT_OPTIONS = ["プロジェクト外"];

export { formatCurrency };

export function buildMonthOptions() {
  return buildMonths(6);
}
