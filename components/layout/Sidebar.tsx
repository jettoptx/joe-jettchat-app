"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Bell,
  MessageSquare,
  Bot,
  Settings,
  LogOut,
  Eye,
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
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex flex-col items-center w-[68px] h-full bg-background border-r border-border py-3">
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
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-mono font-bold">
                    J
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuItem className="font-mono text-xs">
                @jettoptx
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
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
