"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Bell,
  MessageSquare,
  Bot,
  Mic,
  Settings,
  LogOut,
  Eye,
  Menu,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/chat", icon: MessageSquare, label: "Messages" },
  { href: "/agents", icon: Bot, label: "My Agents" },
];

const BOTTOM_ITEMS = [
  { href: "/voice", icon: Mic, label: "VoiceJOE" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface XProfile {
  id: string;
  username: string;
  name: string;
  avatar: string;
  verified: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const [xProfile, setXProfile] = useState<XProfile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const match = document.cookie
        .split("; ")
        .find((c) => c.startsWith("x_profile="));
      if (match) {
        const raw = decodeURIComponent(match.split("=").slice(1).join("="));
        setXProfile(JSON.parse(raw));
      }
    } catch {}
  }, []);

  // Auto-close the mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // Hide the floating hamburger inside a chat thread — that view has its own back button.
  const isInsideThread = pathname?.startsWith("/chat/");

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile hamburger — fixed top-left, only < md */}
      {!isInsideThread && (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-2 left-2 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-background/80 backdrop-blur border border-border text-foreground safe-top"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          flex fixed md:static inset-y-0 left-0 z-50
          flex-col items-center w-[68px] h-full bg-background border-r border-border py-3
          transition-transform duration-200 ease-out
        `}
      >
        {/* Mobile-only close button */}
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-2 right-[-44px] flex items-center justify-center w-11 h-11 rounded-full bg-background/80 backdrop-blur border border-border text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center w-12 h-12 mb-4 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/optx-logo.png"
            alt="OPTX"
            width={48}
            height={48}
            className="object-contain"
            priority
          />
        </Link>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col items-center gap-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href === "/chat" ? "/" : href}
                  className={`
                    relative flex items-center justify-center w-12 h-12 rounded-full
                    transition-all duration-150
                    ${
                      isActive(href)
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }
                  `}
                >
                  {isActive(href) && (
                    <span className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                  <Icon className="w-[22px] h-[22px]" strokeWidth={isActive(href) ? 2.5 : 1.8} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-1">
          {/* MOA toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="augment-space-btn flex items-center justify-center w-12 h-12 rounded-full transition-all duration-150 hover:opacity-80"
                aria-label="Map of Augments"
                onClick={() => window.dispatchEvent(new CustomEvent("augment-space-toggle"))}
              >
                <Image
                  src="/astroknotsLOGO.png"
                  alt="Map of Augments"
                  width={28}
                  height={28}
                  className="object-contain"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Map of Augments
            </TooltipContent>
          </Tooltip>

          {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link
                  href={href}
                  className={`
                    flex items-center justify-center w-12 h-12 rounded-full
                    transition-colors
                    ${
                      isActive(href)
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }
                  `}
                >
                  <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {label}
              </TooltipContent>
            </Tooltip>
          ))}

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="mt-2 rounded-full ring-2 ring-transparent hover:ring-primary/30 transition-all">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={xProfile?.avatar || ""} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-mono font-bold">
                    {xProfile?.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuItem className="font-mono text-xs">
                @{xProfile?.username || "..."}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive cursor-pointer"
                onClick={() => { window.location.href = "/api/auth/logout"; }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
