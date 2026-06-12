"use client";

import { Star } from "lucide-react";

interface Props {
  distribution: Record<string, number>;
}

const STAR_COLORS = ["#EF4444", "#F97316", "#EAB308", "#84CC16", "#22C55E"];

export function RatingDistribution({ distribution }: Props) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-text-muted text-sm">No ratings yet</p>;

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[String(star)] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-0.5 w-8 text-text-muted">
              {star}<Star className="w-3 h-3 fill-current" style={{ color: STAR_COLORS[star - 1] }} />
            </span>
            <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: STAR_COLORS[star - 1],
                }}
              />
            </div>
            <span className="w-8 text-right text-text-muted">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
