"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyRevenue } from "@/lib/api";
import { formatNaira } from "@/lib/utils";

interface Props {
  data: DailyRevenue[];
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl shadow-xl p-3 text-xs space-y-1">
      <p className="font-medium text-text">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "Revenue" ? formatNaira(p.value) : `${p.value} jobs`}
        </p>
      ))}
    </div>
  );
};

export function RevenueChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={formatted} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="rev"
          orientation="left"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          yAxisId="jobs"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 8 }}
        />
        <Bar
          yAxisId="rev"
          dataKey="revenue"
          name="Revenue"
          fill="var(--primary)"
          fillOpacity={0.7}
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="jobs"
          dataKey="job_count"
          name="Jobs"
          stroke="#60A5FA"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
