import { getToken, clearToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, ...rest } = options;
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorised");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  get: <T>(path: string, init?: RequestOptions) =>
    request<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: "PUT", body }),

  delete: <T>(path: string, init?: RequestOptions) =>
    request<T>(path, { ...init, method: "DELETE" }),
};

// ── Typed endpoint helpers ─────────────────────────────────────────────────

export interface AdminStats {
  total_jobs: number;
  completed_jobs: number;
  active_jobs: number;
  cancelled_jobs: number;
  total_revenue: number;
  avg_rating: number;
  todays_jobs: number;
  this_week_jobs: number;
  this_week_revenue: number;
  this_month_jobs: number;
  this_month_revenue: number;
  total_customers: number;
  total_janitors: number;
  active_janitors: number;
}

export interface GrowthMetrics {
  completion_rate: number;
  cancellation_rate: number;
  payment_collection_rate: number;
  repeat_customer_rate: number;
  avg_jobs_per_active_janitor_week: number;
  median_booking_lead_time_hours: number;
  rating_distribution: Record<string, number>;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  job_count: number;
}

export interface RevenueData {
  daily: DailyRevenue[];
  by_service: { service_type: string; revenue: number; count: number }[];
  total_revenue: number;
  total_jobs: number;
}

export interface Job {
  id: string;
  customer_name: string;
  janitor_name: string | null;
  service_type: string;
  status: string;
  payment_status: string;
  price: number;
  transport_fee: number | null;
  rooms: number | null;         // field name from DB query
  scheduled_date: string;
  created_at: string;
  address: string | null;
  // Only available on single-job GET, not in list endpoint
  customer_email?: string;
  num_toilets?: number | null;
  notes?: string | null;
}

export interface JobsResponse {
  jobs: Job[];
  count: number;   // total matching rows
  page: number;
  limit: number;
}

export interface Application {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  bank_name: string | null;
  account_number: string | null;
  status: string;
  created_at: string;
  nin_verified: boolean;
  notes: string | null;
}

export interface Janitor {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  trust_score: number;
  trust_tier: string;
  completed_jobs: number;
  is_available: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  booking_count: number;   // field name from DB query (COUNT(j.id))
  is_active: boolean;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  role: string;
  total_spend: number;
}

export type AdminLevel = "super_admin" | "admin" | "viewer";

export interface Admin {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  admin_level: AdminLevel | null;
  created_at: string;
}

// ── Broadcast messaging ─────────────────────────────────────────────────────

export type BroadcastChannel = "email" | "push" | "both";
export type BroadcastAudience =
  | "all_customers"
  | "all_janitors"
  | "all_users"
  | "specific_user";

export interface Broadcast {
  id: string;
  channel: BroadcastChannel;
  audience: BroadcastAudience;
  target_id: string | null;
  subject: string | null;
  body: string;
  sent_count: number;
  sent_by_name: string;
  created_at: string;
}

// ── Financial dashboard ─────────────────────────────────────────────────────

export interface FinanceDaily {
  date: string;
  revenue: number;
  payout: number;
  job_count: number;
}

export interface FinanceSummary {
  days: number;
  commission_rate: number;
  gross_revenue: number;
  realized_jobs: number;
  janitor_payouts: number;
  platform_commission: number;
  manual_expenses: number;
  net_profit: number;
  outstanding_value: number;
  outstanding_count: number;
  daily: FinanceDaily[];
}

export interface Payout {
  janitor_id: string;
  full_name: string;
  job_count: number;
  gross: number;
  payout: number;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  incurred_on: string;
  created_at: string;
  recorded_by_name: string;
}

export interface JanitorDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string | null;
  service_types: string[];
  experience: string | null;
  bio: string | null;
  availability: boolean;
  is_verified: boolean;
  verified_at: string | null;
  trust_score: number;
  trust_tier: string;
  avg_rating: number;
  punctuality_rate: number;
  approval_status: string;
  created_at: string;
}

export interface Rating {
  id: string;
  score: number;
  comment: string | null;
  customer_name: string;
  janitor_name: string;
  created_at: string;
  job_id: string;
}

/** Flat key→value pricing config as returned by GET /v1/admin/pricing */
export type PricingConfig = Record<string, number>;

export interface PricingResponse {
  config: PricingConfig;
}

export interface AlertsResponse {
  stale_jobs: Job[];
  overdue_jobs: Job[];
}
