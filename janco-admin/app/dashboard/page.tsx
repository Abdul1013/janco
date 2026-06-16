"use client";

import { useState } from "react";
import { useStats, useGrowthMetrics, useRevenueData, useAlerts } from "@/hooks/useStats";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ServicePieChart } from "@/components/charts/ServicePieChart";
import { Badge } from "@/components/ui/Badge";
import { formatNaira, pct, formatDateTime } from "@/lib/utils";
import {
  Briefcase,
  CheckCircle,
  Clock,
  DollarSign,
  Star,
  Users,
  UserCheck,
  AlertTriangle,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";

function SupplyDemandGauge({ activeJanitors, pendingJobs }: { activeJanitors: number; pendingJobs: number }) {
  const ratio = pendingJobs === 0 ? Infinity : activeJanitors / pendingJobs;
  const status = ratio >= 1.5 ? "healthy" : ratio >= 0.8 ? "tight" : "stressed";
  const colors = {
    healthy: { bar: "bg-success", text: "text-success", label: "Healthy" },
    tight: { bar: "bg-warning", text: "text-warning", label: "Tight" },
    stressed: { bar: "bg-error", text: "text-error", label: "Stressed" },
  }[status];
  const fillPct = Math.min(100, (ratio / 3) * 100);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Supply / Demand</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-text">
            {activeJanitors}:{pendingJobs}
          </p>
          <p className="text-xs text-text-muted mt-0.5">janitors : pending jobs</p>
        </div>
        <span className={`text-sm font-semibold ${colors.text}`}>{colors.label}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [revDays, setRevDays] = useState(14);
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: growth, isLoading: growthLoading } = useGrowthMetrics();
  const { data: revenue } = useRevenueData(revDays);
  const { data: alerts } = useAlerts();

  const totalAlerts = (alerts?.stale_jobs.length ?? 0) + (alerts?.overdue_jobs.length ?? 0);

  return (
    <div className="space-y-8">
      {/* Alert banner */}
      {totalAlerts > 0 && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <span className="text-text">
            <span className="font-semibold text-warning">{totalAlerts} alert{totalAlerts > 1 ? "s" : ""}</span>
            {" — "}
            {alerts?.stale_jobs.length ?? 0} stale job{(alerts?.stale_jobs.length ?? 0) !== 1 ? "s" : ""}
            {" · "}
            {alerts?.overdue_jobs.length ?? 0} overdue
          </span>
          <a href="/dashboard/analytics" className="ml-auto text-xs font-medium text-warning hover:underline">
            View all →
          </a>
        </div>
      )}

      {/* KPI grid */}
      <section>
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Operations</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard title="Total Jobs" value={stats?.total_jobs ?? 0} icon={Briefcase} />
              <StatCard title="Completed" value={stats?.completed_jobs ?? 0} icon={CheckCircle} highlight />
              <StatCard title="Active" value={stats?.active_jobs ?? 0} icon={Activity} />
              <StatCard title="Today" value={stats?.todays_jobs ?? 0} icon={Clock} />
              <StatCard
                title="Total Revenue"
                value={formatNaira(stats?.total_revenue ?? 0)}
                icon={DollarSign}
                highlight
              />
              <StatCard title="Avg Rating" value={(stats?.avg_rating ?? 0).toFixed(2)} icon={Star} />
              <StatCard title="Customers" value={stats?.total_customers ?? 0} icon={Users} />
              <StatCard
                title="Active Janitors"
                value={`${stats?.active_janitors ?? 0} / ${stats?.total_janitors ?? 0}`}
                icon={UserCheck}
              />
            </>
          )}
        </div>
      </section>

      {/* Growth engine */}
      <section>
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Growth Engine</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {growthLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                title="Completion Rate"
                value={pct(growth?.completion_rate ?? 0)}
                sub="completed / (completed + cancelled)"
                icon={TrendingUp}
                highlight={(growth?.completion_rate ?? 0) >= 0.8}
              />
              <StatCard
                title="Payment Collection"
                value={pct(growth?.payment_collection_rate ?? 0)}
                sub="paid / completed jobs"
                icon={DollarSign}
              />
              <StatCard
                title="Repeat Customers"
                value={pct(growth?.repeat_customer_rate ?? 0)}
                sub="customers with ≥2 bookings"
                icon={Users}
              />
              <StatCard
                title="Janitor Utilisation"
                value={`${(growth?.avg_jobs_per_active_janitor_week ?? 0).toFixed(1)} jobs/wk`}
                sub="per active janitor"
                icon={Zap}
              />
              {stats && (
                <SupplyDemandGauge
                  activeJanitors={stats.active_janitors}
                  pendingJobs={stats.active_jobs}
                />
              )}
              <StatCard
                title="RevPAJ"
                value={
                  stats && stats.active_janitors > 0
                    ? formatNaira(Math.round((stats.this_week_revenue ?? 0) / stats.active_janitors))
                    : "—"
                }
                sub="revenue / active janitor / week"
                icon={DollarSign}
                highlight
              />
              <StatCard
                title="Median Lead Time"
                value={`${growth?.median_booking_lead_time_hours ?? 0}h`}
                sub="booking to scheduled date"
                icon={Clock}
              />
              <StatCard
                title="Cancellation Rate"
                value={pct(growth?.cancellation_rate ?? 0)}
                icon={AlertTriangle}
              />
            </>
          )}
        </div>
      </section>

      {/* Revenue chart */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">Revenue Trend</h3>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setRevDays(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  revDays === d
                    ? "bg-primary text-black"
                    : "bg-surface-2 text-text-muted hover:text-text"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          {revenue?.daily ? (
            <RevenueChart data={revenue.daily} />
          ) : (
            <div className="h-[280px] flex items-center justify-center text-text-muted text-sm">
              Loading…
            </div>
          )}
        </div>
      </section>

      {/* Service mix */}
      {revenue?.by_service && revenue.by_service.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Service Mix</h3>
          <div className="bg-surface border border-border rounded-2xl p-5">
            <ServicePieChart data={revenue.by_service} />
          </div>
        </section>
      )}

      {/* Week / Month summary */}
      <section>
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">Periods</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">This Week</p>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-text">{stats?.this_week_jobs ?? "—"}</p>
                <p className="text-xs text-text-muted">jobs</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{formatNaira(stats?.this_week_revenue ?? 0)}</p>
                <p className="text-xs text-text-muted">revenue</p>
              </div>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">This Month</p>
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-text">{stats?.this_month_jobs ?? "—"}</p>
                <p className="text-xs text-text-muted">jobs</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{formatNaira(stats?.this_month_revenue ?? 0)}</p>
                <p className="text-xs text-text-muted">revenue</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
