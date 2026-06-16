"use client";

import { useState } from "react";
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
import {
  useFinanceSummary,
  usePayouts,
  useExpenses,
  useAddExpense,
  useDeleteExpense,
} from "@/hooks/useFinance";
import { SlideOver } from "@/components/ui/SlideOver";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { formatNaira, formatDate, pct } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/auth";
import { Lock, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";

const EXPENSE_CATEGORIES = ["marketing", "salary", "operations", "refund", "other"];

// ── Add expense form ──────────────────────────────────────────────────────────

function AddExpenseForm({ onClose }: { onClose: () => void }) {
  const addExpense = useAddExpense();
  const [category, setCategory] = useState("operations");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredOn, setIncurredOn] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    addExpense.mutate(
      {
        category,
        description,
        amount: amt,
        incurred_on: incurredOn || undefined,
      },
      { onSuccess: onClose }
    );
  };

  const inputCls =
    "w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">Category *</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">Description *</label>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
          placeholder="e.g. Instagram ad campaign"
        />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">Amount (₦) *</label>
        <input
          required
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputCls}
          placeholder="50000"
        />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">Date incurred</label>
        <input
          type="date"
          value={incurredOn}
          onChange={(e) => setIncurredOn(e.target.value)}
          className={inputCls}
        />
        <p className="text-xs text-text-muted mt-1">Defaults to today if left blank.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={addExpense.isPending}
          className="flex-1 bg-primary text-black font-semibold rounded-xl py-2 text-sm hover:bg-primary/80 transition disabled:opacity-60"
        >
          {addExpense.isPending ? "Saving…" : "Record expense"}
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

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "success" | "error" | "default";
}) {
  const color =
    accent === "success" ? "text-success" : accent === "error" ? "text-error" : "text-text";
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function RevenuePayoutChart({
  data,
}: {
  data: { date: string; revenue: number; payout: number }[];
}) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={formatted} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v) => formatNaira(Number(v ?? 0))}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 8 }} />
        <Bar dataKey="revenue" name="Revenue" fill="var(--primary)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
        <Line dataKey="payout" name="Janitor payout" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [days, setDays] = useState(30);
  const [showAdd, setShowAdd] = useState(false);
  const superAdmin = isSuperAdmin();

  const { data: summary, isLoading } = useFinanceSummary(days);
  const { data: payoutsData } = usePayouts(days);
  const { data: expensesData } = useExpenses();
  const deleteExpense = useDeleteExpense();

  if (!superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Lock className="w-10 h-10 text-text-muted mb-3" />
        <h3 className="text-lg font-semibold text-text">Super-admin access required</h3>
        <p className="text-sm text-text-muted mt-1 max-w-sm">
          The financial dashboard is restricted to super-admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Range toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                days === d ? "bg-primary text-black" : "bg-surface-2 text-text-muted hover:text-text"
              }`}
            >
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
        {summary && (
          <p className="text-xs text-text-muted">
            Commission rate: <span className="text-text font-medium">{pct(summary.commission_rate)}</span>
          </p>
        )}
      </div>

      {/* KPIs */}
      {isLoading || !summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="Gross Revenue (paid)" value={formatNaira(summary.gross_revenue)} sub={`${summary.realized_jobs} realized jobs`} />
          <KpiCard label="Platform Commission" value={formatNaira(summary.platform_commission)} accent="success" />
          <KpiCard label="Janitor Payouts" value={formatNaira(summary.janitor_payouts)} sub="auto-computed liability" />
          <KpiCard label="Manual Expenses" value={formatNaira(summary.manual_expenses)} accent="error" />
          <KpiCard
            label="Net Profit"
            value={formatNaira(summary.net_profit)}
            sub="commission − expenses"
            accent={summary.net_profit >= 0 ? "success" : "error"}
          />
          <KpiCard label="Outstanding" value={formatNaira(summary.outstanding_value)} sub={`${summary.outstanding_count} completed, unpaid`} />
        </div>
      )}

      {/* Chart */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Revenue vs Janitor Payout
        </h3>
        {summary && summary.daily.length > 0 ? (
          <RevenuePayoutChart data={summary.daily} />
        ) : (
          <p className="text-center py-12 text-text-muted text-sm">No realized revenue in this period</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payouts leaderboard */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-text">Top Janitor Payouts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {["Janitor", "Jobs", "Gross", "Payout"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(payoutsData?.payouts ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-text-muted">No payouts in this period</td></tr>
                ) : (
                  (payoutsData?.payouts ?? []).map((p) => (
                    <tr key={p.janitor_id} className="border-b border-border/50">
                      <td className="px-4 py-2.5 text-text font-medium">{p.full_name}</td>
                      <td className="px-4 py-2.5 text-text-muted">{p.job_count}</td>
                      <td className="px-4 py-2.5 text-text-muted">{formatNaira(p.gross)}</td>
                      <td className="px-4 py-2.5 text-text font-medium">{formatNaira(p.payout)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense ledger */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-text flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-error" />
              Expense Ledger
            </h3>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-primary text-black rounded-xl px-2.5 py-1 text-xs font-semibold hover:bg-primary/80 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {!expensesData ? (
            <div className="p-5"><SkeletonTable rows={4} /></div>
          ) : expensesData.expenses.length === 0 ? (
            <p className="text-center py-10 text-text-muted text-sm">No expenses recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    {["Description", "Category", "Amount", "Date", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expensesData.expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-4 py-2.5">
                        <p className="text-text">{e.description}</p>
                        <p className="text-xs text-text-muted">{e.recorded_by_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted capitalize">{e.category}</td>
                      <td className="px-4 py-2.5 text-error font-medium">{formatNaira(e.amount)}</td>
                      <td className="px-4 py-2.5 text-text-muted">{formatDate(e.incurred_on)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => deleteExpense.mutate(e.id)}
                          disabled={deleteExpense.isPending}
                          className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition disabled:opacity-40"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} title="Record Expense">
        <AddExpenseForm onClose={() => setShowAdd(false)} />
      </SlideOver>
    </div>
  );
}
