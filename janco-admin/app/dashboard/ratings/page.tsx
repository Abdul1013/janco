"use client";

import { useState } from "react";
import { useRatings } from "@/hooks/useRatings";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDate, formatServiceType } from "@/lib/utils";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function Stars({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "w-4 h-4",
            i < score ? "fill-primary text-primary" : "fill-surface-2 text-border"
          )}
        />
      ))}
    </span>
  );
}

export default function RatingsPage() {
  const [page, setPage] = useState(1);
  const [score, setScore] = useState<number | undefined>(undefined);

  const { data, isLoading } = useRatings({ page, limit: PAGE_SIZE });

  const ratings = data?.ratings ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Star filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => { setScore(undefined); setPage(1); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            score === undefined
              ? "bg-primary text-black"
              : "bg-surface-2 text-text-muted hover:text-text"
          }`}
        >
          All
        </button>
        {[5, 4, 3, 2, 1].map((s) => (
          <button
            key={s}
            onClick={() => { setScore(s); setPage(1); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              score === s
                ? "bg-primary text-black"
                : s <= 2
                ? "bg-error/10 text-error hover:bg-error/20"
                : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {s}<Star className="w-3 h-3 fill-current" />
          </button>
        ))}
      </div>

      {/* Ratings feed */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : (
          <div className="divide-y divide-border/50">
            {ratings.length === 0 ? (
              <p className="text-center py-12 text-text-muted">No ratings found</p>
            ) : (
              ratings.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "px-5 py-4",
                    r.score <= 2 && "bg-error/5 border-l-2 border-error"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Stars score={r.score} />
                        <span className="text-xs text-text-muted">
                          {r.customer_name} → {r.janitor_name}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-text mt-1.5 line-clamp-3">{r.comment}</p>
                      )}
                      {!r.comment && (
                        <p className="text-sm text-text-muted mt-1.5 italic">No comment</p>
                      )}
                    </div>
                    <span className="text-xs text-text-muted flex-shrink-0">
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2">
          <p className="text-xs text-text-muted">
            {total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
              : "0 results"}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-text disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs text-text-muted">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-text-muted hover:text-text disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
