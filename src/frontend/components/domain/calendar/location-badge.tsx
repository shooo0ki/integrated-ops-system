"use client";

import { Building2, Monitor } from "lucide-react";

const LOCATION_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  office: { label: "出社", icon: <Building2 size={9} />, cls: "bg-green-100 text-green-700" },
  online: { label: "オンライン", icon: <Monitor size={9} />, cls: "bg-blue-100 text-blue-700" },
};

export function LocationBadge({ locationType }: { locationType: string }) {
  const cfg = LOCATION_CONFIG[locationType];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-medium leading-none max-w-full truncate shrink-0 ${cfg.cls}`}>
      {cfg.icon}<span className="truncate">{cfg.label}</span>
    </span>
  );
}
