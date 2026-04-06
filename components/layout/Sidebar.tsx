"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Library,
  Grid3X3,
  Search,
  Eye,
  Mic,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: MessageSquare, label: "Chat" },
  { href: "/threads", icon: Library, label: "Library" },
  { href: "/integrations", icon: Grid3X3, label: "Apps" },
  { href: "/xql", icon: Search, label: "XQL", badge: "PRO" as const },
  { href: "/watchlist", icon: Eye, label: "Watchlist", badge: "PRO" as const },
  { href: "/voice", icon: Mic, label: "Voice", badge: "PRO" as const },
  { href: "/agent", icon: Bot, label: "Agent", badge: "MAX" as const },
  { href: "/api-dashboard", icon: BarChart3, label: "API" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        relative flex flex-col h-full bg-surface border-r border-border
        transition-all duration-200
        ${collapsed ? "w-16" : "w-[210px]"}
      `}
    >
      {/* Glow effect */}
      <div className="absolute inset-y-0 left-0 w-1 sidebar-glow" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        {!collapsed && (
          <Link href="/" className="font-display text-accent text-lg font-bold">
            JettChat
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm
                transition-colors
                ${isActive
                  ? "bg-card text-text-primary border-l-2 border-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-card/50"
                }
              `}
            >
              <Icon size={18} />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {badge === "PRO" && <span className="badge-pro">PRO</span>}
                  {badge === "MAX" && <span className="badge-max">MAX</span>}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
              J
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">@jettoptx</p>
              <p className="text-xs text-text-muted">Free</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
