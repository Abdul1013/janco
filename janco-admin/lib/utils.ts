import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-error/15 text-error border-error/30",
};

export const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-error/15 text-error border-error/30",
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  paid: "bg-success/15 text-success border-success/30",
  refunded: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

export const TRUST_TIER_COLORS: Record<string, string> = {
  Platinum: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Gold: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Silver: "bg-gray-400/20 text-gray-300 border-gray-400/30",
  Bronze: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Pending: "bg-surface-2 text-text-muted border-border",
};

export function formatServiceType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
