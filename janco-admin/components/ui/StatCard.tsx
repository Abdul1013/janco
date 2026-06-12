import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: { value: string; up: boolean } | null;
  highlight?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  highlight,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3",
        highlight && "border-primary/40 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</p>
        {Icon && (
          <div
            className={cn(
              "p-1.5 rounded-lg",
              highlight ? "bg-primary/20 text-primary" : "bg-surface-2 text-text-muted"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div>
        <p className={cn("text-2xl font-bold text-text", highlight && "text-primary")}>{value}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <p
          className={cn(
            "text-xs font-medium",
            trend.up ? "text-success" : "text-error"
          )}
        >
          {trend.up ? "▲" : "▼"} {trend.value}
        </p>
      )}
    </div>
  );
}
