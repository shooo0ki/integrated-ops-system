export const MEMBER_STATUS_LABELS: Record<string, string> = {
  executive: "役員",
  employee: "社員",
  intern_full: "インターン（長期）",
  intern_training: "インターン（研修）",
  training_member: "研修生",
};

export const MEMBER_STATUS_COLORS: Record<string, string> = {
  executive: "bg-purple-50 text-purple-700",
  employee: "bg-blue-50 text-blue-700",
  intern_full: "bg-orange-50 text-orange-700",
  intern_training: "bg-orange-50 text-orange-700",
  training_member: "bg-slate-50 text-slate-700",
};

export const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: "月給制",
  hourly: "時給制",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  sent: "送付済み",
  waiting_sign: "署名待ち",
  completed: "完了",
  voided: "無効",
};

export function roleFromStatus(status: string): string {
  if (status === "executive") return "admin";
  if (status === "employee") return "manager";
  return "member";
}
