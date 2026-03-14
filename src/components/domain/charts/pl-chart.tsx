"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface PLChartProps {
  data: { month: string; revenue: number; grossProfit: number; laborCost: number }[];
  company: "Boost" | "SALT2" | "合算";
}

function formatYen(value: number) {
  return `¥${(value / 10000).toFixed(0)}万`;
}

export function PLChart({ data, company }: PLChartProps) {
  const colorMap = {
    Boost: { revenue: "#3b82f6", grossProfit: "#22c55e", labor: "#f59e0b" },
    SALT2: { revenue: "#10b981", grossProfit: "#06b6d4", labor: "#f97316" },
    合算: { revenue: "#6366f1", grossProfit: "#22c55e", labor: "#f59e0b" },
  };
  const colors = colorMap[company];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={formatYen} />
        <Tooltip
          formatter={(value: number) => `¥${value.toLocaleString()}`}
          labelStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="売上" fill={colors.revenue} radius={[3, 3, 0, 0]} />
        <Bar dataKey="grossProfit" name="粗利" fill={colors.grossProfit} radius={[3, 3, 0, 0]} />
        <Bar dataKey="laborCost" name="労務費" fill={colors.labor} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProjectPLAreaChart({
  data,
}: {
  data: { month: string; revenue: number; laborCost: number; grossProfit: number }[];
}) {
  function formatYAxis(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return String(value);
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorLaborCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorGrossProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={55} />
        <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
        <Legend />
        <Area type="monotone" dataKey="revenue" name="売上" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
        <Area type="monotone" dataKey="laborCost" name="労務費" stroke="#f59e0b" fill="url(#colorLaborCost)" strokeWidth={2} />
        <Area type="monotone" dataKey="grossProfit" name="粗利" stroke="#10b981" fill="url(#colorGrossProfit)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PLTrendLine({ data }: { data: { month: string; revenue: number; grossProfit: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={formatYen} />
        <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="revenue" name="売上" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="grossProfit" name="粗利" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
