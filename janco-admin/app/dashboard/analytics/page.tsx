"use client";

import { useGrowthMetrics, useAlerts, useRevenueData } from "@/hooks/useStats";
import { useActiveJanitors } from "@/hooks/useJanitors";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { RatingDistribution } from "@/components/charts/RatingDistribution";
import { ServicePieChart } from "@/components/charts/ServicePieChart";
import {
  formatNaira, formatDate, formatServiceType, pct,
  STATUS_COLORS, TRUST_TIER_COLORS,
} from "@/lib/utils";
import {
  TrendingUp, Users, Zap, Clock, AlertTriangle, Star, DollarSign,
} from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

export default function AnalyticsPage() {
  const { data: growth, isLoading: growthLoading } = useGrowthMetrics();
  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const { data: janitors } = useActiveJanitors();
  const { data: revenue } = useRevenueData(30);

  const top5Janitors = (janitors ?? []).sort((a, b) => b.trust_score - a.trust_score).slice(0, 5);

  return (
    <div className="space-y-10">

      {/* A — Funnel metrics */}
      <Section title="Retention & Conversion">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {growthLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                title="Completion Rate"
                value={pct(growth?.completion_rate ?? 0)}
                sub={`${pct(growth?.cancellation_rate ?? 0)} cancellation`}
                icon={TrendingUp}
                highlight={(growth?.completion_rate ?? 0) >= 0.8}
              />
              <StatCard
                title="Payment Collection"
                value={pct(growth?.payment_collection_rate ?? 0)}
                sub="paid / completed"
                icon={DollarSign}
              />
              <StatCard
                title="Repeat Customer Rate"
                value={pct(growth?.repeat_customer_rate ?? 0)}
                sub="customers with ≥2 bookings"
                icon={Users}
              />
              <StatCard
                title="Median Lead Time"
                value={`${growth?.median_booking_lead_time_hours ?? 0}h`}
                sub="booking → scheduled"
                icon={Clock}
              />
            </>
          )}
        </div>
      </Section>

      {/* B — Supply */}
      <Section title="Supply & Utilisation">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatCard
            title="Janitor Utilisation"
            value={`${(growth?.avg_jobs_per_active_janitor_week ?? 0).toFixed(1)} jobs/week`}
            sub="avg per active janitor"
            icon={Zap}
          />

          {/* Top janitors table */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <p className="px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border bg-surface-2">
              Top Janitors by Trust Score
            </p>
            <table className="w-full text-sm">
              <tbody>
                {top5Janitors.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-text-muted">No data</td></tr>
                ) : (
                  top5Janitors.map((j, i) => (
                    <tr key={j.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-text-muted text-xs w-6">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{j.full_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={j.trust_tier} className={TRUST_TIER_COLORS[j.trust_tier] ?? ""} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center gap-1 justify-end text-text-muted text-xs">
                          <Star className="w-3 h-3 fill-primary text-primary" />
                          {j.trust_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-text-muted">{j.completed_jobs} jobs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* C — Rating Health */}
      <Section title="Rating Health">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Distribution
            </p>
            {growth?.rating_distribution ? (
              <RatingDistribution distribution={growth.rating_distribution} />
            ) : (
              <p className="text-text-muted text-sm">Loading…</p>
            )}
          </div>
          <StatCard
            title="Overall Avg Rating"
            value={
              growth?.rating_distribution
                ? (() => {
                    const d = growth.rating_distribution;
                    const total = Object.values(d).reduce((a, b) => a + b, 0);
                    const sum = Object.entries(d).reduce(
                      (a, [k, v]) => a + Number(k) * v, 0
                    );
                    return total > 0 ? (sum / total).toFixed(2) : "—";
                  })()
                : "—"
            }
            sub="across all completed jobs"
            icon={Star}
            highlight
          />
        </div>
      </Section>

      {/* D — Service Mix */}
      {revenue?.by_service && revenue.by_service.length > 0 && (
        <Section title="Service Mix (30 days)">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <ServicePieChart data={revenue.by_service} />
            </div>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    {["Service", "Jobs", "Revenue"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {revenue.by_service
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((s) => (
                      <tr key={s.service_type} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 font-medium text-text">{formatServiceType(s.service_type)}</td>
                        <td className="px-4 py-3 text-text-muted">{s.count}</td>
                        <td className="px-4 py-3 text-text">{formatNaira(s.revenue)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {/* E — Operational Alerts */}
      <Section title="Operational Alerts">
        <div className="space-y-6">
          {/* Stale jobs */}
          <div>
            <p className="text-xs font-medium text-warning mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Stale jobs (pending, unassigned, &gt;24h old)
            </p>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              {alertsLoading ? (
                <div className="p-4"><SkeletonTable rows={3} /></div>
              ) : (alerts?.stale_jobs.length ?? 0) === 0 ? (
                <p className="px-4 py-6 text-center text-text-muted text-sm">No stale jobs</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      {["Customer", "Service", "Scheduled", "Created"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alerts?.stale_jobs.map((j) => (
                      <tr key={j.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-text">{j.customer_name}</td>
                        <td className="px-4 py-2.5 text-text-muted">{formatServiceType(j.service_type)}</td>
                        <td className="px-4 py-2.5 text-text-muted">{formatDate(j.scheduled_date)}</td>
                        <td className="px-4 py-2.5 text-text-muted">{formatDate(j.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Overdue jobs */}
          <div>
            <p className="text-xs font-medium text-error mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue jobs (past scheduled date, not completed)
            </p>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              {alertsLoading ? (
                <div className="p-4"><SkeletonTable rows={3} /></div>
              ) : (alerts?.overdue_jobs.length ?? 0) === 0 ? (
                <p className="px-4 py-6 text-center text-text-muted text-sm">No overdue jobs</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      {["Customer", "Janitor", "Service", "Status", "Scheduled"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alerts?.overdue_jobs.map((j) => (
                      <tr key={j.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-text">{j.customer_name}</td>
                        <td className="px-4 py-2.5 text-text-muted">{j.janitor_name ?? "Unassigned"}</td>
                        <td className="px-4 py-2.5 text-text-muted">{formatServiceType(j.service_type)}</td>
                        <td className="px-4 py-2.5">
                          <Badge label={j.status.replace(/_/g, " ")} className={STATUS_COLORS[j.status]} />
                        </td>
                        <td className="px-4 py-2.5 text-error font-medium">{formatDate(j.scheduled_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
