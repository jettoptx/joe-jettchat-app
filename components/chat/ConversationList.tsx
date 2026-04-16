"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/hooks/useSession";
import {
  Search,
  SquarePen,
  Shield,
  Rocket,
  Mic,
  BarChart3,
  Bookmark,
  Terminal,
  Library,
  Puzzle,
  Zap,
  Eye,
  Palette,
  Store,
  Lock,
  X,
  Loader2,
  Hash,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConversationItem, type Conversation } from "./ConversationItem";
import { MyAgents } from "./MyAgents";
import { Separator } from "@/components/ui/separator";

const UPCOMING_FEATURES = [
  { icon: Terminal, name: "XQL", desc: "Query blockchain data with natural language", status: "planned" as const },
  { icon: Mic, name: "Voice Rooms", desc: "Encrypted voice channels for agents & users", status: "planned" as const },
  { icon: Bookmark, name: "Watchlist", desc: "Track wallets, tokens, and agent activity", status: "planned" as const },
  { icon: Library, name: "Threads", desc: "Threaded conversations with context retention", status: "planned" as const },
  { icon: Puzzle, name: "Integrations", desc: "Connect external tools and MCP servers", status: "planned" as const },
  { icon: BarChart3, name: "API Dashboard", desc: "Monitor agent API usage and x402 earnings", status: "planned" as const },
  { icon: Palette, name: "AGT Themes", desc: "COG (gold) / ENV (blue) / EMO (red) color modes", status: "design" as const },
  { icon: Store, name: "Agent Market", desc: "AgentC marketplace — browse, spawn, trade agents", status: "building" as const },
  { icon: Lock, name: "E2E Encryption", desc: "Signal-grade TKDF encryption for all DMs", status: "building" as const },
  { icon: Eye, name: "Gaze Auth", desc: "AGT biometric login via camera + JETT Auth", status: "building" as const },
  { icon: Zap, name: "averageJOE Spawn", desc: "Deploy your own JOE agent with $OPTX + $8", status: "building" as const },
] as const;

/** Format a timestamp into a relative/short string */
function formatTimestamp(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const FILTERS = ["All", "Unread", "Direct", "Groups", "Requests"] as const;

function StatusDot({ status }: { status: "planned" | "design" | "building" }) {
  const colors = {
    planned: "bg-zinc-500",
    design: "bg-amber-500",
    building: "bg-green-500 animate-pulse",
  }
  return <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
}

export function ConversationList() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [showRoadmap, setShowRoadmap] = useState(false);
  const { session } = useSession();

  // Convex real-time queries
  const convexConversations = useQuery(
    api.conversations.listForUser,
    session?.xId ? { xId: session.xId } : "skip"
  );
  const channels = useQuery(api.channels.list);

  const activeConvoId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]
    : null;

  // Map Convex docs → Conversation UI type
  const conversations: Conversation[] = useMemo(() => {
    if (!convexConversations) return [];
    return convexConversations.map((c) => ({
      id: c._id,
      name: c.name || c.participants.filter((p) => p !== session?.xId).join(", ") || "Unknown",
      username: c.slug || c.participants.find((p) => p !== session?.xId) || "",
      lastMessage: c.lastMessagePreview || "No messages yet",
      timestamp: c.lastMessageAt ? formatTimestamp(c.lastMessageAt) : formatTimestamp(c.createdAt),
      unread: false, // TODO: track read cursor per user
      verified: false,
      isEncrypted: c.isEncrypted,
    }));
  }, [convexConversations, session?.xId]);

  const isLoading = session?.xId && convexConversations === undefined;

  const filtered = conversations.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
    }
    if (filter === "Unread") return c.unread;
    return true;
  });

  return (
    <div
      className="hidden md:flex flex-col h-full md:w-[320px] md:max-w-[320px] md:shrink-0 border-r border-border bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowRoadmap(!showRoadmap)}
                  className={`p-2 rounded-full transition-colors ${
                    showRoadmap
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Rocket className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Roadmap</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                  <SquarePen className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent>New message</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Direct Messages"
            className="pl-9 h-9 bg-secondary border-0 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/40"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pb-1 shrink-0">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="w-full bg-transparent h-8 p-0 gap-0">
            {FILTERS.map((f) => (
              <TabsTrigger
                key={f}
                value={f}
                className="flex-1 h-8 text-xs font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground"
              >
                {f}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Roadmap panel */}
      {showRoadmap && (
        <ScrollArea className="flex-1">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                Roadmap
              </h3>
              <button
                onClick={() => setShowRoadmap(false)}
                className="p-1 rounded-full hover:bg-secondary text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4 font-mono">
              JettChat will be the interface for all agents — including Claude, Grok, and your averageJOEs.
            </p>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1"><StatusDot status="building" /> Building</span>
              <span className="flex items-center gap-1"><StatusDot status="design" /> Design</span>
              <span className="flex items-center gap-1"><StatusDot status="planned" /> Planned</span>
            </div>

            <div className="space-y-1">
              {UPCOMING_FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.name}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{feature.name}</span>
                        <StatusDot status={feature.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator className="my-3" />
            <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
              jettoptx.chat
            </p>
          </div>
        </ScrollArea>
      )}

      {/* Conversation list */}
      {!showRoadmap && (
        <ScrollArea className="flex-1">
          {/* Channels section */}
          {channels && channels.length > 0 && (
            <div className="px-3 pt-2 pb-1">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                Channels
              </h3>
              {channels.map((ch) => {
                const isChannelActive = activeConvoId === ch.conversationId;
                const isGated = ch.type === "gated";
                const isHash = ch.slug.startsWith("#");
                return (
                  <Link
                    key={ch._id}
                    href={ch.conversationId ? `/chat/${ch.conversationId}` : "#"}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm",
                      isChannelActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {isHash ? (
                      <Hash className="w-4 h-4 shrink-0" />
                    ) : (
                      <DollarSign className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{ch.name.toLowerCase()}</span>
                    {isGated && (
                      <Lock className="w-3 h-3 ml-auto shrink-0 text-muted-foreground/50" />
                    )}
                  </Link>
                );
              })}
              <Separator className="mt-2" />
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
            </div>
          )}

          {/* Conversations */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-3 pt-1 pb-1">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                Direct Messages
              </h3>
            </div>
          )}
          {!isLoading && filtered.map((convo) => (
            <ConversationItem
              key={convo.id}
              conversation={convo}
              isActive={activeConvoId === convo.id}
            />
          ))}

          {!isLoading && filtered.length === 0 && !channels?.length && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Shield className="w-10 h-10 text-primary/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {session ? "No conversations yet" : "Sign in to see your messages"}
              </p>
              {session && (
                <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                  Start a new message or join a channel
                </p>
              )}
            </div>
          )}

          {/* My Agents section */}
          <div className="px-3 py-3">
            <Separator className="mb-3" />
            <MyAgents />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
