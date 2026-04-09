"use client";

import { useState } from "react";

import { SelfReportCard } from "@/frontend/components/domain/closing/self-report-card";
import { Select } from "@/frontend/components/common/input";

function buildMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

const MONTHS = buildMonths(6);

export default function SelfReportsPage() {
  const [month, setMonth] = useState(MONTHS[0]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">月次工数自己申告</h1>
          <p className="text-sm text-slate-500">プロジェクトごとの工数配分を申告</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m.replace("-", "年")}月</option>
            ))}
          </Select>
        </div>
      </div>

      <SelfReportCard month={month} />
    </div>
  );
}
