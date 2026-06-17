"use client";

import { usePathname } from "next/navigation";
import { RefreshCw, Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/jobs": "Jobs",
  "/dashboard/janitors": "Janitors",
  "/dashboard/customers": "Customers",
  "/dashboard/broadcast": "Broadcast",
  "/dashboard/admins": "Admins",
  "/dashboard/finance": "Finance",
  "/dashboard/analytics": "Analytics",
  "/dashboard/pricing": "Pricing",
  "/dashboard/ratings": "Ratings",
};

export default function Topbar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-surface flex-shrink-0">
      <h2 className="text-lg font-semibold text-text">{title}</h2>

      <div className="flex items-center gap-2">
        {/* Global refresh */}
        <button
          onClick={() => queryClient.invalidateQueries()}
          title="Refresh all data"
          className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Placeholder notification bell */}
        <button
          title="Alerts"
          className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Admin avatar */}
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black text-xs font-bold ml-1">
          A
        </div>
      </div>
    </header>
  );
}
