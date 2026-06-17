"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { logout, getAdminLevel } from "@/lib/auth";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  UserCheck,
  BarChart3,
  DollarSign,
  Star,
  ShieldCheck,
  Megaphone,
  Wallet,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

// superAdminOnly items are hidden from 'admin' and 'viewer' tiers.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/janitors", label: "Janitors", icon: UserCheck },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/broadcast", label: "Broadcast", icon: Megaphone },
  { href: "/dashboard/admins", label: "Admins", icon: ShieldCheck, superAdminOnly: true },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet, superAdminOnly: true },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/pricing", label: "Pricing", icon: DollarSign, superAdminOnly: true },
  { href: "/dashboard/ratings", label: "Ratings", icon: Star },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Read admin tier after mount to avoid SSR/client hydration mismatch
  // (the JWT lives in localStorage, unavailable during server render).
  const [level, setLevel] = useState<string | null>(null);
  useEffect(() => {
    setLevel(getAdminLevel());
  }, [pathname]);
  const isSuper = level === "super_admin";
  const navItems = NAV_ITEMS.filter((it) => !it.superAdminOnly || isSuper);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-surface border-r border-border transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2 px-4 py-5 border-b border-border", collapsed && "justify-center px-0")}>
        <span className="font-display text-2xl text-primary leading-none">J</span>
        {!collapsed && (
          <span className="font-display text-xl text-primary leading-none">ANCO</span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-text-muted hover:text-text hover:bg-surface-2",
                collapsed && "justify-center px-0 mx-2"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={cn("border-t border-border p-2", collapsed && "flex justify-center")}>
        <button
          onClick={() => logout()}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-text-muted hover:text-error hover:bg-error/10 transition-all",
            collapsed && "justify-center px-0 w-auto"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-2 transition"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
