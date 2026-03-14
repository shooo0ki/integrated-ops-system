export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  completed: "完了",
  on_hold: "一時停止",
  planning: "計画中",
};

export const PROJECT_STATUS_COLORS: Record<string, "success" | "default" | "warning"> = {
  active: "success",
  completed: "default",
  on_hold: "warning",
  planning: "warning",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  quasi_mandate: "準委任",
  contract: "請負",
  in_house: "自社開発",
  other: "その他",
};

export function companyDisplay(c: string): string {
  return c === "boost" ? "Boost" : "SALT2";
}
