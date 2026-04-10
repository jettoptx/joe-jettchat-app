"use client";

import React from "react";
import { Bot, Cpu, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AgentType = "joe" | "astrojoe" | "traderjoe" | "custom";

export interface X402Policy {
  maxPerRequest: number;
  currency: string;
  enabled: boolean;
}

export interface AgentBadgeProps {
  agentType: AgentType;
  erc8002Score: number;
  x402Policy?: X402Policy;
  className?: string;
}

function trustColor(score: number): string {
  if (score <= 30) return "#ef4444";
  if (score <= 60) return "#f59e0b";
  if (score <= 85) return "#3b82f6";
  return "#22c55e";
}

function trustLabel(score: number): string {
  if (score <= 30) return "Low Trust";
  if (score <= 60) return "Moderate Trust";
  if (score <= 85) return "High Trust";
  return "Verified";
}

function AgentTypeIcon({ type }: { type: AgentType }) {
  const cls = "w-3 h-3 text-purple-400";
  if (type === "astrojoe") return <Cpu className={cls} />;
  if (type === "traderjoe") return <TrendingUp className={cls} />;
  return <Bot className={cls} />;
}

export function AgentBadge({
  agentType,
  erc8002Score,
  x402Policy,
  className,
}: AgentBadgeProps) {
  const color = trustColor(erc8002Score);
  const label = trustLabel(erc8002Score);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("inline-flex items-center gap-1.5", className)}>
        {/* AGENT pill */}
        <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[8px] h-4 px-1.5 gap-1 font-mono font-semibold rounded-full">
          <AgentTypeIcon type={agentType} />
          AGENT
        </Badge>

        {/* Trust score bar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${erc8002Score}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="bg-zinc-900 border-zinc-700 text-zinc-200 text-xs font-mono"
          >
            ERC-8002 Score: {erc8002Score}/100 — {label}
          </TooltipContent>
        </Tooltip>

        {/* x402 indicator */}
        {x402Policy?.enabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-mono font-bold cursor-default">
                $
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-zinc-900 border-zinc-700 text-zinc-200 text-xs font-mono"
            >
              x402 enabled — max {x402Policy.maxPerRequest}{" "}
              {x402Policy.currency} / request
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
