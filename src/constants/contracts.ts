import type { ContractStatus } from "@/types/contracts";

export const STATUS_ORDER: ContractStatus[] = ["draft", "sent", "waiting_sign", "completed", "voided"];

export const FLOW_STEPS: { key: ContractStatus; label: string }[] = [
  { key: "draft", label: "下書き" },
  { key: "sent", label: "送付済" },
  { key: "waiting_sign", label: "署名待ち" },
  { key: "completed", label: "締結完了" },
];

export function formatDate(s: string) {
  return s.slice(0, 10).replace(/-/g, "/");
}
