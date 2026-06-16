"use client";

import { useState } from "react";
import { useSendBroadcast, useBroadcastHistory } from "@/hooks/useBroadcast";
import { useCustomers } from "@/hooks/useCustomers";
import { SlideOver } from "@/components/ui/SlideOver";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/utils";
import type {
  BroadcastChannel,
  BroadcastAudience,
  Customer,
} from "@/lib/api";
import { Mail, Bell, Send, Users, Search } from "lucide-react";

const CHANNELS: { value: BroadcastChannel; label: string; icon: typeof Mail }[] = [
  { value: "both", label: "Email + Push", icon: Send },
  { value: "email", label: "Email only", icon: Mail },
  { value: "push", label: "Push only", icon: Bell },
];

const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: "all_users", label: "All users" },
  { value: "all_customers", label: "All customers" },
  { value: "all_janitors", label: "All janitors" },
  { value: "specific_user", label: "Specific user" },
];

const AUDIENCE_LABELS: Record<string, string> = {
  all_users: "All users",
  all_customers: "All customers",
  all_janitors: "All janitors",
  specific_user: "Specific user",
};

// ── Specific-user picker (reuses customer search) ─────────────────────────────

function UserPicker({
  selected,
  onSelect,
}: {
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data } = useCustomers({ limit: 8, search: debounced || undefined });

  const handleSearch = (val: string) => {
    setSearch(val);
    const t = setTimeout(() => setDebounced(val), 350);
    return () => clearTimeout(t);
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-surface-2 border border-border rounded-xl px-3 py-2">
        <div>
          <p className="text-sm text-text font-medium">{selected.full_name}</p>
          <p className="text-xs text-text-muted">{selected.email}</p>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-text-muted hover:text-text"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search customer by name or email…"
          className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      {debounced && (data?.users ?? []).length > 0 && (
        <div className="border border-border rounded-xl divide-y divide-border/50 overflow-hidden">
          {(data?.users ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-surface-2 transition"
            >
              <p className="text-sm text-text">{c.full_name}</p>
              <p className="text-xs text-text-muted">{c.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BroadcastPage() {
  const send = useSendBroadcast();
  const { data: history, isLoading } = useBroadcastHistory();

  const [channel, setChannel] = useState<BroadcastChannel>("both");
  const [audience, setAudience] = useState<BroadcastAudience>("all_users");
  const [target, setTarget] = useState<Customer | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const needsSubject = channel === "email" || channel === "both";
  const valid =
    body.trim().length > 0 &&
    (!needsSubject || subject.trim().length > 0) &&
    (audience !== "specific_user" || !!target);

  const handleSend = () => {
    send.mutate(
      {
        channel,
        audience,
        target_id: audience === "specific_user" ? target?.id : undefined,
        subject: needsSubject ? subject : undefined,
        body,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setSubject("");
          setBody("");
          setTarget(null);
        },
      }
    );
  };

  const inputCls =
    "w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compose */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-text">Compose broadcast</h3>

        {/* Channel */}
        <div>
          <label className="text-xs text-text-muted block mb-1.5">Channel</label>
          <div className="flex gap-1.5">
            {CHANNELS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setChannel(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  channel === value
                    ? "bg-primary text-black"
                    : "bg-surface-2 text-text-muted hover:text-text"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div>
          <label className="text-xs text-text-muted block mb-1.5">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as BroadcastAudience)}
            className={inputCls}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {audience === "specific_user" && (
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Recipient</label>
            <UserPicker selected={target} onSelect={setTarget} />
          </div>
        )}

        {/* Subject */}
        {needsSubject && (
          <div>
            <label className="text-xs text-text-muted block mb-1.5">
              Subject {channel === "both" ? "(email subject + push title)" : "(email subject)"}
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="A short, clear subject"
              className={inputCls}
            />
          </div>
        )}

        {/* Body */}
        <div>
          <label className="text-xs text-text-muted block mb-1.5">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write your update or promotion…"
            className={inputCls + " resize-none"}
          />
        </div>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!valid}
          className="w-full bg-primary text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-primary/80 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Review & send
        </button>
      </div>

      {/* History */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-text">Recent broadcasts</h3>
        </div>
        {isLoading ? (
          <div className="p-5"><SkeletonTable rows={5} /></div>
        ) : (history?.broadcasts ?? []).length === 0 ? (
          <p className="text-center py-12 text-text-muted text-sm">No broadcasts sent yet</p>
        ) : (
          <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
            {(history?.broadcasts ?? []).map((b) => (
              <div key={b.id} className="px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    label={b.channel}
                    className="bg-primary/15 text-primary border-primary/30 capitalize"
                  />
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <Users className="w-3 h-3" />
                    {AUDIENCE_LABELS[b.audience] ?? b.audience} · {b.sent_count}
                  </span>
                </div>
                {b.subject && <p className="text-sm text-text font-medium mt-1.5">{b.subject}</p>}
                <p className="text-sm text-text-muted mt-0.5 line-clamp-2">{b.body}</p>
                <p className="text-xs text-text-muted mt-1">
                  {b.sent_by_name} · {formatDateTime(b.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm slide-over */}
      <SlideOver open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm broadcast">
        <div className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Channel</dt>
              <dd className="text-text font-medium capitalize">{channel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Audience</dt>
              <dd className="text-text font-medium">
                {audience === "specific_user" ? target?.full_name : AUDIENCE_LABELS[audience]}
              </dd>
            </div>
            {needsSubject && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Subject</dt>
                <dd className="text-text font-medium">{subject}</dd>
              </div>
            )}
          </dl>
          <div className="bg-surface-2 border border-border rounded-xl p-3">
            <p className="text-sm text-text whitespace-pre-wrap">{body}</p>
          </div>
          <p className="text-xs text-text-muted">
            This will send to the selected audience immediately. Delivery happens in the
            background.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={send.isPending}
              className="flex-1 bg-primary text-black font-semibold rounded-xl py-2 text-sm hover:bg-primary/80 transition disabled:opacity-60"
            >
              {send.isPending ? "Sending…" : "Send broadcast"}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="flex-1 bg-surface-2 border border-border rounded-xl py-2 text-sm text-text-muted hover:text-text transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
