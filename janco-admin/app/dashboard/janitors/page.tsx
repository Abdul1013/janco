"use client";

import { useState } from "react";
import {
  useApplications,
  useApplication,
  useUpdateApplication,
  useActiveJanitors,
  useJanitorDetail,
  useCreateJanitor,
} from "@/hooks/useJanitors";
import { SlideOver } from "@/components/ui/SlideOver";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDate, TRUST_TIER_COLORS } from "@/lib/utils";
import { Star, Plus, Eye } from "lucide-react";

const APP_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-error/15 text-error border-error/30",
};

const APP_FILTERS = ["", "pending", "approved", "rejected"];

// ── Application detail ────────────────────────────────────────────────────────

function ApplicationDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data: app, isLoading } = useApplication(id);
  const update = useUpdateApplication();
  const [notes, setNotes] = useState("");

  if (isLoading || !app) {
    return <p className="text-text-muted text-sm animate-pulse">Loading…</p>;
  }

  const fields: [string, string | boolean | null][] = [
    ["Full name", app.full_name],
    ["Email", app.email],
    ["Phone", app.phone],
    ["Address", app.address],
    ["Guarantor", app.guarantor_name ?? "—"],
    ["Guarantor phone", app.guarantor_phone ?? "—"],
    ["Bank", app.bank_name ?? "—"],
    ["Account number", app.account_number ?? "—"],
    ["NIN verified", app.nin_verified ? "Yes" : "No"],
    ["Applied", formatDate(app.created_at)],
    ["Status", app.status],
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt className="text-text-muted text-xs">{k}</dt>
            <dd className="text-text font-medium mt-0.5">{String(v)}</dd>
          </div>
        ))}
      </dl>

      {app.status === "pending" && (
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Add reason for approval or rejection…"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                update.mutate({ id: app.id, status: "approved", notes: notes || undefined });
                onClose();
              }}
              disabled={update.isPending}
              className="flex-1 bg-success/15 border border-success/30 text-success rounded-xl py-2 text-sm font-medium hover:bg-success/25 transition disabled:opacity-60"
            >
              Approve
            </button>
            <button
              onClick={() => {
                update.mutate({ id: app.id, status: "rejected", notes: notes || undefined });
                onClose();
              }}
              disabled={update.isPending}
              className="flex-1 bg-error/15 border border-error/30 text-error rounded-xl py-2 text-sm font-medium hover:bg-error/25 transition disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Janitor detail (read-only) ────────────────────────────────────────────────

function JanitorDetailPanel({ id }: { id: string }) {
  const { data, isLoading } = useJanitorDetail(id);

  if (isLoading || !data) {
    return <p className="text-text-muted text-sm animate-pulse">Loading…</p>;
  }

  const fields: [string, string | number | boolean | null][] = [
    ["Email", data.email],
    ["Phone", data.phone],
    ["Address", data.address ?? "—"],
    ["Services", data.service_types?.join(", ") || "—"],
    ["Experience", data.experience ?? "—"],
    ["Bio", data.bio ?? "—"],
    ["Availability", data.availability ? "Available" : "Unavailable"],
    ["Verified", data.is_verified ? "Yes" : "No"],
    ["Verified at", data.verified_at ? formatDate(data.verified_at) : "—"],
    ["Approval", data.approval_status],
    ["Avg rating", data.avg_rating?.toFixed(1) ?? "—"],
    ["Punctuality rate", data.punctuality_rate ? `${(data.punctuality_rate * 100).toFixed(0)}%` : "—"],
    ["Trust score", data.trust_score?.toFixed(1) ?? "—"],
    ["Joined", formatDate(data.created_at)],
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
          {data.full_name?.[0] ?? "J"}
        </div>
        <div>
          <p className="font-semibold text-text">{data.full_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              label={data.trust_tier}
              className={TRUST_TIER_COLORS[data.trust_tier] ?? "bg-surface-2 text-text-muted border-border"}
            />
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Star className="w-3 h-3 fill-primary text-primary" />
              {data.trust_score?.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-border pt-4">
        {fields.map(([k, v]) => (
          <div key={k} className={k === "Bio" || k === "Services" ? "col-span-2" : ""}>
            <dt className="text-text-muted text-xs">{k}</dt>
            <dd className="text-text font-medium mt-0.5">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Create janitor form ───────────────────────────────────────────────────────

function CreateJanitorForm({ onClose }: { onClose: () => void }) {
  const createJanitor = useCreateJanitor();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    address: "",
    service_types_raw: "",   // comma-separated string, split on submit
    experience: "",
    bio: "",
  });
  const [showPw, setShowPw] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const service_types = form.service_types_raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    createJanitor.mutate(
      {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        address: form.address,
        service_types,
        experience: form.experience || undefined,
        bio: form.bio || undefined,
      },
      { onSuccess: onClose }
    );
  };

  const inputCls =
    "w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-text-muted block mb-1">Full name *</label>
          <input required value={form.full_name} onChange={set("full_name")} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-text-muted block mb-1">Email *</label>
          <input required type="email" value={form.email} onChange={set("email")} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-text-muted block mb-1">Password *</label>
          <div className="relative">
            <input
              required
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              className={inputCls + " pr-16"}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Phone *</label>
          <input required value={form.phone} onChange={set("phone")} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Address *</label>
          <input required value={form.address} onChange={set("address")} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-text-muted block mb-1">
            Service types <span className="text-text-muted/60">(comma-separated)</span>
          </label>
          <input
            placeholder="standard_cleaning, deep_cleaning, laundry"
            value={form.service_types_raw}
            onChange={set("service_types_raw")}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Experience</label>
          <input value={form.experience} onChange={set("experience")} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Bio</label>
          <input value={form.bio} onChange={set("bio")} className={inputCls} />
        </div>
      </div>

      <p className="text-xs text-text-muted bg-surface-2 border border-border rounded-xl px-3 py-2">
        This account is auto-approved and auto-verified. The janitor can set their password after first login.
      </p>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={createJanitor.isPending}
          className="flex-1 bg-primary text-black font-semibold rounded-xl py-2 text-sm hover:bg-primary/80 transition disabled:opacity-60"
        >
          {createJanitor.isPending ? "Creating…" : "Create janitor"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-surface-2 border border-border rounded-xl py-2 text-sm text-text-muted hover:text-text transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Applications tab ──────────────────────────────────────────────────────────

function ApplicationsTab() {
  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: apps, isLoading } = useApplications(filter || undefined);

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {APP_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
              filter === f
                ? "bg-primary text-black"
                : "bg-surface-2 text-text-muted hover:text-text"
            }`}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {["Applicant", "Phone", "NIN", "Status", "Applied"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(apps ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-text-muted">No applications</td>
                  </tr>
                ) : (
                  (apps ?? []).map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedId(app.id)}
                      className="border-b border-border/50 hover:bg-surface-2 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{app.full_name}</p>
                        <p className="text-xs text-text-muted">{app.email}</p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{app.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${app.nin_verified ? "text-success" : "text-error"}`}>
                          {app.nin_verified ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={app.status} className={APP_STATUS_COLORS[app.status]} />
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(app.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SlideOver open={!!selectedId} onClose={() => setSelectedId(null)} title="Application">
        {selectedId && <ApplicationDetail id={selectedId} onClose={() => setSelectedId(null)} />}
      </SlideOver>
    </div>
  );
}

// ── Roster tab ────────────────────────────────────────────────────────────────

function RosterTab() {
  const { data: janitors, isLoading } = useActiveJanitors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header with Add Janitor button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {janitors ? `${janitors.length} active janitor${janitors.length !== 1 ? "s" : ""}` : ""}
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-primary text-black rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-primary/80 transition"
        >
          <Plus className="w-4 h-4" />
          Add Janitor
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={6} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {["Janitor", "Trust Tier", "Score", "Jobs Done", "Availability", "Joined", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(janitors ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-text-muted">No active janitors</td>
                  </tr>
                ) : (
                  (janitors ?? []).map((j) => (
                    <tr key={j.id} className="border-b border-border/50 hover:bg-surface-2 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{j.full_name}</p>
                        <p className="text-xs text-text-muted">{j.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={j.trust_tier} className={TRUST_TIER_COLORS[j.trust_tier] ?? ""} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-text-muted">
                          <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                          {j.trust_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text">{j.completed_jobs}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${j.is_available ? "text-success" : "text-text-muted"}`}>
                          {j.is_available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(j.created_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedId(j.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Janitor detail slide-over */}
      <SlideOver
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        title="Janitor Profile"
      >
        {selectedId && <JanitorDetailPanel key={selectedId} id={selectedId} />}
      </SlideOver>

      {/* Create janitor slide-over */}
      <SlideOver
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Janitor"
        wide
      >
        <CreateJanitorForm onClose={() => setShowCreate(false)} />
      </SlideOver>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JanitorsPage() {
  const [tab, setTab] = useState<"applications" | "roster">("applications");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border pb-0">
        {(["applications", "roster"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "applications" ? <ApplicationsTab /> : <RosterTab />}
    </div>
  );
}
