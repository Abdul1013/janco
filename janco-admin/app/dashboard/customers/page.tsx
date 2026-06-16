"use client";

import { useState, useCallback } from "react";
import {
  useCustomers,
  useCustomerDetail,
  useEditCustomer,
  useSuspendCustomer,
} from "@/hooks/useCustomers";
import { SlideOver } from "@/components/ui/SlideOver";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDate, formatNaira } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

// ── Customer detail slide-over ────────────────────────────────────────────────

function CustomerDetailPanel({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useCustomerDetail(id);
  const editMutation = useEditCustomer();
  const suspendMutation = useSuspendCustomer();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Seed edit fields when data arrives
  const [seeded, setSeeded] = useState(false);
  if (data && !seeded) {
    setFullName(data.full_name ?? "");
    setPhone(data.phone ?? "");
    setSeeded(true);
  }

  if (isLoading || !data) {
    return <p className="text-text-muted text-sm animate-pulse">Loading…</p>;
  }

  const handleSave = () => {
    const updates: { full_name?: string; phone?: string } = {};
    if (fullName !== data.full_name) updates.full_name = fullName;
    if (phone !== (data.phone ?? "")) updates.phone = phone || undefined;
    if (Object.keys(updates).length === 0) {
      setEditMode(false);
      return;
    }
    editMutation.mutate({ id, ...updates }, { onSuccess: () => setEditMode(false) });
  };

  const handleToggleSuspend = () => {
    suspendMutation.mutate({ id, is_active: !data.is_active });
  };

  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <Badge
          label={data.is_active ? "Active" : "Suspended"}
          className={
            data.is_active
              ? "bg-success/15 text-success border-success/30"
              : "bg-error/15 text-error border-error/30"
          }
        />
        <span className="text-xs text-text-muted capitalize">{data.role}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-2 rounded-xl p-3">
          <p className="text-xs text-text-muted">Bookings</p>
          <p className="text-2xl font-bold text-text mt-0.5">{data.booking_count}</p>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <p className="text-xs text-text-muted">Total Spend</p>
          <p className="text-2xl font-bold text-text mt-0.5">{formatNaira(data.total_spend)}</p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <label className="text-xs text-text-muted block mb-1">Email</label>
          <p className="text-sm text-text">{data.email}</p>
        </div>

        {editMode ? (
          <>
            <div>
              <label className="text-xs text-text-muted block mb-1">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={editMutation.isPending}
                className="flex-1 bg-primary text-black rounded-xl py-2 text-sm font-semibold hover:bg-primary/80 transition disabled:opacity-60"
              >
                Save
              </button>
              <button
                onClick={() => { setEditMode(false); setFullName(data.full_name ?? ""); setPhone(data.phone ?? ""); }}
                className="flex-1 bg-surface-2 border border-border rounded-xl py-2 text-sm text-text-muted hover:text-text transition"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs text-text-muted block mb-1">Full name</label>
              <p className="text-sm text-text">{data.full_name}</p>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Phone</label>
              <p className="text-sm text-text">{data.phone ?? "—"}</p>
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Joined</label>
              <p className="text-sm text-text">{formatDate(data.created_at)}</p>
            </div>
            <button
              onClick={() => setEditMode(true)}
              className="w-full bg-surface-2 border border-border rounded-xl py-2 text-sm text-text hover:bg-primary/10 hover:border-primary/30 transition"
            >
              Edit profile
            </button>
          </>
        )}
      </div>

      {/* Suspend / reactivate */}
      {!editMode && (
        <div className="border-t border-border pt-4">
          <button
            onClick={handleToggleSuspend}
            disabled={suspendMutation.isPending}
            className={`w-full rounded-xl py-2 text-sm font-semibold transition disabled:opacity-60 ${
              data.is_active
                ? "bg-error/10 border border-error/30 text-error hover:bg-error/20"
                : "bg-success/10 border border-success/30 text-success hover:bg-success/20"
            }`}
          >
            {suspendMutation.isPending
              ? "Saving…"
              : data.is_active
              ? "Suspend account"
              : "Reactivate account"}
          </button>
          <p className="text-xs text-text-muted mt-2 text-center">
            {data.is_active
              ? "Suspended accounts cannot log in."
              : "This will restore login access."}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    const t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const { data, isLoading } = useCustomers({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const customers = data?.users ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
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
                  {["Customer", "Phone", "Status", "Bookings", "Joined"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-text-muted">
                      {debouncedSearch ? `No customers matching "${debouncedSearch}"` : "No customers yet"}
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="border-b border-border/50 hover:bg-surface-2 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{c.full_name}</p>
                        <p className="text-xs text-text-muted">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          label={c.is_active ? "Active" : "Suspended"}
                          className={
                            c.is_active
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-error/15 text-error border-error/30"
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                            c.booking_count >= 5
                              ? "bg-primary/20 text-primary"
                              : "bg-surface-2 text-text-muted"
                          }`}
                        >
                          {c.booking_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(c.created_at)}</td>
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

      {/* Customer detail slide-over */}
      <SlideOver
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Customer"
      >
        {selectedId && (
          <CustomerDetailPanel
            key={selectedId}
            id={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}
