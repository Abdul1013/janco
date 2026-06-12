"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatNaira, formatServiceType } from "@/lib/utils";

interface ServiceData {
  service_type: string;
  revenue: number;
  count: number;
}

const COLORS = ["#CDDC39", "#60A5FA", "#F472B6", "#34D399", "#FBBF24", "#A78BFA"];

export function ServicePieChart({ data }: { data: ServiceData[] }) {
  const formatted = data.map((d) => ({
    ...d,
    name: formatServiceType(d.service_type),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={formatted}
          dataKey="revenue"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
        >
          {formatted.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatNaira(Number(v ?? 0))}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(v) => <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
