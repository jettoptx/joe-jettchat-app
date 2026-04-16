"use client";

import React, { useState, useMemo } from "react";
import { Bot, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentCard, type AgentCardData } from "./AgentCard";
import { type AgentType } from "./AgentBadge";
import { cn } from "@/lib/utils";

// Default known agents — in production these come from Convex `agents` table
const DEFAULT_AGENTS: AgentCardData[] = [
  {
    id: "astrojoe",
    name: "AstroJOE",
    xHandle: "jettoptx",
    agentType: "astrojoe",
    solanaWallet: "EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk",
    erc8002Score: 92,
    x402Policy: {
      maxPerRequest: 5,
      currency: "JTX",
      enabled: true,
    },
  },
  {
    id: "edgejoe",
    name: "Edge JOE",
    xHandle: "jettoptx",
    agentType: "joe",
    solanaWallet: "PJM2Y4xqCSqxX1g9AWN5ejy8s6o9SeGfUTbj2cKEycs",
    erc8002Score: 78,
    x402Policy: {
      maxPerRequest: 2,
      currency: "JTX",
      enabled: true,
    },
  },
  {
    id: "traderjoe",
    name: "TraderJOE",
    xHandle: "jettoptx",
    agentType: "traderjoe",
    solanaWallet: "FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H",
    erc8002Score: 65,
    x402Policy: {
      maxPerRequest: 10,
      currency: "USDC",
      enabled: true,
    },
  },
];

type FilterTab = "all" | AgentType;
type SortKey = "trust" | "name";

interface AgentDirectoryProps {
  agents?: AgentCardData[];
  onTip?: (agent: AgentCardData) => void;
  onViewHistory?: (agent: AgentCardData) => void;
  onSelectAgent?: (agent: AgentCardData) => void;
}

export function AgentDirectory({
  agents = DEFAULT_AGENTS,
  onTip,
  onViewHistory,
  onSelectAgent,
}: AgentDirectoryProps) {
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("trust");

  const filtered = useMemo(() => {
    let list = agents;

    // Filter by type
    if (filterTab !== "all") {
      list = list.filter((a) => a.agentType === filterTab);
    }

    // Search by handle or name
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.xHandle.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey === "trust") {
      list = [...list].sort((a, b) => b.erc8002Score - a.erc8002Score);
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [agents, filterTab, search, sortKey]);

  return (
    <div className="flex flex-col h-full min-w-0 bg-background overflow-x-hidden">
      {/* Header */}
      <div className="pl-16 md:pl-6 pr-4 md:pr-6 pt-6 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-none">
              Agent Directory
            </h1>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {agents.length} registered agent{agents.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or handle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs font-mono bg-secondary/40 border-border/60 focus:border-purple-500/50 focus:ring-purple-500/20"
            aria-label="Search agents"
          />
        </div>
      </div>

      {/* Filter tabs + sort */}
      <div className="px-4 md:px-6 py-3 border-b border-border/40 flex items-center gap-3 overflow-x-auto">
        <Tabs
          value={filterTab}
          onValueChange={(v) => setFilterTab(v as FilterTab)}
          className="flex-1"
        >
          <TabsList className="h-7 bg-secondary/40 gap-0.5 p-0.5">
            {(["all", "joe", "astrojoe", "traderjoe", "custom"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "h-6 text-[10px] font-mono px-2 capitalize data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300",
                  "data-[state=inactive]:text-muted-foreground"
                )}
              >
                {tab === "all" ? "All" : tab === "joe" ? "JOE" : tab === "astrojoe" ? "AstroJOE" : tab === "traderjoe" ? "TraderJOE" : "Custom"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Sort toggle */}
        <button
          onClick={() => setSortKey((k) => (k === "trust" ? "name" : "trust"))}
          className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          aria-label={`Sort by ${sortKey === "trust" ? "name" : "trust score"}`}
        >
          Sort: {sortKey === "trust" ? "Trust" : "Name"}
        </button>
      </div>

      {/* Agent grid */}
      <ScrollArea className="flex-1 px-4 md:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-mono">No agents found</p>
            <p className="text-xs text-muted-foreground/60 font-mono mt-1">
              Try a different search or filter
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onSelectAgent?.(agent)}
                className={cn(onSelectAgent && "cursor-pointer")}
              >
                <AgentCard
                  agent={agent}
                  onTip={onTip}
                  onViewHistory={onViewHistory}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
