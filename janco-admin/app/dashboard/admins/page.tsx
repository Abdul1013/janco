"use client";

import { useState } from "react";
import {
  useAdmins,
  useCreateAdmin,
  useRevokeAdmin,
  useSetAdminLevel,
} from "@/hooks/useAdmins";
import { SlideOver } from "@/components/ui/SlideOver";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import { getCurrentUserId, isSuperAdmin } from "@/lib/auth";
import type { AdminLevel } from "@/lib/api";
import { ShieldCheck, Plus, Trash2, Lock } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  viewer: "Viewer",
};

const LEVEL_COLORS: Record<string, string> = {
  super_admin: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  admin: "bg-primary/15 text-primary border-primary/30",
  viewer: "bg-surface-2 text-text-muted border-border",
};

const LEVEL_OPTIONS: AdminLevel[] = ["super_admin", "admin", "viewer"];

// ── Create admin form ─────────────────────────────────────────────────────────

function CreateAdminForm({ onClose }: { onClose: () => void }) {
  const createAdmin = useCreateAdmin();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<AdminLevel>("admin");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAdmin.mutate(
      { email, full_name: fullName, password, level },
      { onSuccess: onClose }
    );
  };

  const inputCls =
    "w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">Full name *</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputCls}
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">Email *</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
          placeholder="admin@janco.ng"
        />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">Password *</label>
        <div className="relative">
          <input
            required
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls + " pr-16"}
            placeholder="Min 8 chars, uppercase + digit"
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
        <label className="text-xs text-text-muted block mb-1">Authorization level *</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as AdminLevel)}
          className={inputCls}
        >
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
          ))}
        </select>
        <p className="text-xs text-text-muted mt-1.5">
          {level === "super_admin"
            ? "Full access — financials, admin management, pricing."
            : level === "admin"
            ? "Day-to-day ops + broadcasts. No financials, admin management, or pricing."
            : "Read-only — can view dashboards but cannot make changes."}
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={createAdmin.isPending}
          className="flex-1 bg-primary text-black font-semibold rounded-xl py-2 text-sm hover:bg-primary/80 transition disabled:opacity-60"
        >
          {createAdmin.isPending ? "Creating…" : "Create admin"}
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

// ── Revoke confirmation ───────────────────────────────────────────────────────

function RevokeConfirm({
  name,
  onConfirm,
  onCancel,
  isPending,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text">
        Revoke admin role from <span className="font-semibold">{name}</span>? They will be
        demoted to a regular customer account and lose dashboard access immediately.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 bg-error/15 border border-error/30 text-error rounded-xl py-2 text-sm font-medium hover:bg-error/25 transition disabled:opacity-60"
        >
          {isPending ? "Revoking…" : "Yes, revoke"}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-surface-2 border border-border rounded-xl py-2 text-sm text-text-muted hover:text-text transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const { data: admins, isLoading } = useAdmins();
  const revokeAdmin = useRevokeAdmin();
  const setLevel = useSetAdminLevel();
  const [showCreate, setShowCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const currentUserId = getCurrentUserId();
  const superAdmin = isSuperAdmin();
  const adminCount = admins?.length ?? 0;

  // Manage-admins is a super_admin-only capability — the backend enforces it,
  // but we surface a clear notice instead of failed actions for other tiers.
  if (!superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Lock className="w-10 h-10 text-text-muted mb-3" />
        <h3 className="text-lg font-semibold text-text">Super-admin access required</h3>
        <p className="text-sm text-text-muted mt-1 max-w-sm">
          Admin account management is restricted to super-admins. Contact a super-admin if
          you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <ShieldCheck className="w-4 h-4" />
          <span>{adminCount} admin{adminCount !== 1 ? "s" : ""}</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-primary text-black rounded-xl px-3 py-1.5 text-sm font-semibold hover:bg-primary/80 transition"
        >
          <Plus className="w-4 h-4" />
          Add Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={4} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {["Admin", "Level", "Status", "Joined", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(admins ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-text-muted">
                      No admins found
                    </td>
                  </tr>
                ) : (
                  (admins ?? []).map((admin) => {
                    const isSelf = admin.id === currentUserId;
                    const isLastAdmin = adminCount <= 1;
                    const canRevoke = !isSelf && !isLastAdmin;
                    const level = admin.admin_level ?? "admin";

                    return (
                      <tr
                        key={admin.id}
                        className="border-b border-border/50 hover:bg-surface-2 transition"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-text">{admin.full_name}</p>
                          <p className="text-xs text-text-muted">{admin.email}</p>
                          {isSelf && (
                            <span className="text-xs text-primary/70 font-medium">(you)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isSelf ? (
                            <Badge
                              label={LEVEL_LABELS[level]}
                              className={LEVEL_COLORS[level]}
                            />
                          ) : (
                            <select
                              value={level}
                              onChange={(e) =>
                                setLevel.mutate({
                                  id: admin.id,
                                  level: e.target.value as AdminLevel,
                                })
                              }
                              disabled={setLevel.isPending}
                              className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                            >
                              {LEVEL_OPTIONS.map((l) => (
                                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            label={admin.is_active ? "Active" : "Suspended"}
                            className={
                              admin.is_active
                                ? "bg-success/15 text-success border-success/30"
                                : "bg-error/15 text-error border-error/30"
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-text-muted">{formatDate(admin.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              setRevokeTarget({ id: admin.id, name: admin.full_name })
                            }
                            disabled={!canRevoke}
                            title={
                              isSelf
                                ? "You cannot revoke your own role"
                                : isLastAdmin
                                ? "Cannot remove the last admin"
                                : "Revoke admin role"
                            }
                            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create admin slide-over */}
      <SlideOver
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Admin"
      >
        <CreateAdminForm onClose={() => setShowCreate(false)} />
      </SlideOver>

      {/* Revoke confirmation slide-over */}
      <SlideOver
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Admin Role"
      >
        {revokeTarget && (
          <RevokeConfirm
            name={revokeTarget.name}
            isPending={revokeAdmin.isPending}
            onConfirm={() => {
              revokeAdmin.mutate(revokeTarget.id, {
                onSuccess: () => setRevokeTarget(null),
              });
            }}
            onCancel={() => setRevokeTarget(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}
