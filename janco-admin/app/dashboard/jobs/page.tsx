"use client";

import { useState, useCallback } from "react";
import { useJobs, useJob, useUpdateJobStatus, useUpdatePaymentStatus } from "@/hooks/useJobs";
import { SlideOver } from "@/components/ui/SlideOver";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  formatNaira,
  formatDate,
  formatDateTime,
  formatServiceType,
  STATUS_COLORS,
  PAYMENT_COLORS,
} from "@/lib/utils";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import type { Job } from "@/lib/api";

const PAGE_SIZE = 20;

const STATUSES = ["", "pending", "confirmed", "in_progress", "completed", "cancelled"];
const PAY_STATUSES = ["", "unpaid", "pending", "paid"];

function JobDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: job, isLoading } = useJob(id);
  const updateStatus = useUpdateJobStatus();
  const updatePayment = useUpdatePaymentStatus();

  if (isLoading || !job) {
    return <p className="text-text-muted text-sm animate-pulse">Loading…</p>;
  }

  const fields: [string, string | number | null][] = [
    ["Customer", job.customer_name],
    ["Email", job.customer_email ?? "—"],
    ["Janitor", job.janitor_name ?? "Unassigned"],
    ["Service", formatServiceType(job.service_type)],
    ["Status", job.status],
    ["Payment", job.payment_status],
    ["Price", formatNaira(job.price)],
    ["Rooms", job.rooms ?? "—"],
    ["Toilets", job.num_toilets ?? "—"],
    ["Transport fee", job.transport_fee ? formatNaira(job.transport_fee) : "—"],
    ["Address", job.address ?? "—"],
    ["Scheduled", formatDateTime(job.scheduled_date)],
    ["Created", formatDateTime(job.created_at)],
    ["Notes", job.notes ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-text-muted text-xs">{k}</dt>
            <dd className="text-text font-medium mt-0.5">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>

      {/* Actions */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Update status</label>
          <select
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
            defaultValue={job.status}
            onChange={(e) => updateStatus.mutate({ id: job.id, status: e.target.value })}
          >
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        {job.payment_status !== "paid" && (
          <button
            onClick={() => updatePayment.mutate({ id: job.id })}
            disabled={updatePayment.isPending}
            className="w-full bg-success/15 border border-success/30 text-success rounded-xl py-2 text-sm font-medium hover:bg-success/25 transition disabled:opacity-60"
          >
            Mark as Paid
          </button>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce search
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    const t = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, []);

  const { data, isLoading } = useJobs({
    page,
    limit: PAGE_SIZE,
    status: status || undefined,
    payment_status: payStatus || undefined,
  });

  const jobs = data?.jobs ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function exportCSV() {
    const headers = ["ID", "Customer", "Service", "Status", "Payment", "Price", "Scheduled", "Janitor"];
    const rows = jobs.map((j) => [
      j.id, j.customer_name, j.service_type, j.status, j.payment_status,
      j.price, j.scheduled_date, j.janitor_name ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `janco-jobs-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search customer, janitor…"
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={payStatus}
          onChange={(e) => { setPayStatus(e.target.value); setPage(1); }}
          className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All payments</option>
          {PAY_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-2 transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {["Customer", "Service", "Janitor", "Status", "Payment", "Price", "Scheduled"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-text-muted">No jobs found</td>
                  </tr>
                ) : (
                  jobs.map((job: Job) => (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedId(job.id)}
                      className="border-b border-border/50 hover:bg-surface-2 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{job.customer_name}</p>
                        <p className="text-xs text-text-muted">{job.customer_email}</p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatServiceType(job.service_type)}</td>
                      <td className="px-4 py-3 text-text-muted">{job.janitor_name ?? <span className="text-error">Unassigned</span>}</td>
                      <td className="px-4 py-3">
                        <Badge label={job.status.replace(/_/g, " ")} className={STATUS_COLORS[job.status]} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={job.payment_status} className={PAYMENT_COLORS[job.payment_status]} />
                      </td>
                      <td className="px-4 py-3 font-medium text-text">{formatNaira(job.price)}</td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(job.scheduled_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-2">
          <p className="text-xs text-text-muted">
            {total > 0 ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}` : "0 results"}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs text-text-muted">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Job detail slide-over */}
      <SlideOver
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Job Details"
      >
        {selectedId && <JobDetail id={selectedId} onClose={() => setSelectedId(null)} />}
      </SlideOver>
    </div>
  );
}
