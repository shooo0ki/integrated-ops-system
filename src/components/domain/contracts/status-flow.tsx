"use client";

import { FLOW_STEPS } from "@/constants/contracts";
import { Badge } from "@/components/common/badge";
import type { ContractStatus } from "@/types/contracts";

export function StatusFlow({ current }: { current: ContractStatus }) {
  const activeIdx = FLOW_STEPS.findIndex((s) => s.key === current);
  if (current === "voided") return <Badge variant="danger">無効</Badge>;
  return (
    <div className="flex items-center gap-1">
      {FLOW_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              i < activeIdx
                ? "bg-slate-200 text-slate-500"
                : i === activeIdx
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {step.label}
          </span>
          {i < FLOW_STEPS.length - 1 && (
            <span className={`text-xs ${i < activeIdx ? "text-slate-400" : "text-slate-200"}`}>›</span>
          )}
        </div>
      ))}
    </div>
  );
}
