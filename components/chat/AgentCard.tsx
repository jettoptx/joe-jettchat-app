"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink, DollarSign, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentBadge, type AgentType, type X402Policy } from "./AgentBadge";
import { cn } from "@/lib/utils";

export interface AgentCardData {
  id: string;
  name: string;
  xHandle: string;
  avatarUrl?: string;
  agentType: AgentType;
  solanaWallet: string;
  erc8002Score: number;
  x402Policy: X402Policy;
  publicKey?: string;
}

interface AgentCardProps {
  agent: AgentCardData;
  onTip?: (agent: AgentCardData) => void;
  onViewHistory?: (agent: AgentCardData) => void;
  className?: string;
}

function truncateWallet(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function trustColor(score: number): string {
  if (score <= 30) return "#ef4444";
  if (score <= 60) return "#f59e0b";
  if (score <= 85) return "#3b82f6";
  return "#22c55e";
}

function trustLabel(score: number): string {
  if (score <= 30) return "Low";
  if (score <= 60) return "Moderate";
  if (score <= 85) return "High";
  return "Verified";
}

function agentTypeLabel(type: AgentType): string {
  if (type === "astrojoe") return "AstroJOE";
  if (type === "traderjoe") return "TraderJOE";
  if (type === "joe") return "JOE Core";
  return "Custom";
}

export function AgentCard({
  agent,
  onTip,
  onViewHistory,
  className,
}: AgentCardProps) {
  const [copied, setCopied] = useState(false);
  const color = trustColor(agent.erc8002Score);
  const label = trustLabel(agent.erc8002Score);

  function handleCopyWallet() {
    navigator.clipboard.writeText(agent.solanaWallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const solscanUrl = `https://solscan.io/account/${agent.solanaWallet}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        className={cn(
          "bg-zinc-950 border border-purple-500/30 rounded-2xl shadow-lg shadow-purple-950/20",
          className
        )}
      >
        {/* Purple accent top line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/60 to-transparent rounded-t-2xl" />

        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <Avatar className="w-12 h-12 shrink-0 border border-purple-500/30">
              <AvatarImage src={agent.avatarUrl} />
              <AvatarFallback className="bg-purple-500/15 text-purple-300 font-mono font-bold text-sm">
                {agent.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name + handle + type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground truncate">
                  {agent.name}
                </span>
                <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[9px] font-mono h-4 px-1.5">
                  {agentTypeLabel(agent.agentType)}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                @{agent.xHandle}
              </span>
              <div className="mt-1.5">
                <AgentBadge
                  agentType={agent.agentType}
                  erc8002Score={agent.erc8002Score}
                  x402Policy={agent.x402Policy}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 space-y-4">
          {/* Trust score meter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                ERC-8002 Trust Score
              </span>
              <span
                className="text-[11px] font-mono font-semibold"
                style={{ color }}
              >
                {agent.erc8002Score}/100 — {label}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${agent.erc8002Score}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}60`,
                }}
              />
            </div>
          </div>

          {/* Solana wallet */}
          <div>
            <span className="block text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
              Solana Wallet
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-300">
                {truncateWallet(agent.solanaWallet)}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCopyWallet}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy wallet address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-zinc-900 border-zinc-700 text-zinc-200 text-xs font-mono"
                >
                  {copied ? "Copied!" : "Copy address"}
                </TooltipContent>
              </Tooltip>
              <a
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition-colors"
              >
                Solscan
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {/* x402 policy */}
          <div>
            <span className="block text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
              x402 Payment Policy
            </span>
            {agent.x402Policy.enabled ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-mono text-zinc-300">
                    Max {agent.x402Policy.maxPerRequest}{" "}
                    {agent.x402Policy.currency} / request
                  </span>
                </div>
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[8px] h-3.5 px-1 font-mono">
                  ACTIVE
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-mono">Payments disabled</span>
              </div>
            )}
          </div>

          {/* Verified on Solana */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#22c55e]" />
            <a
              href={solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-green-400 hover:text-green-300 flex items-center gap-0.5 transition-colors"
            >
              Verified on Solana
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTip?.(agent)}
              className="flex-1 h-8 text-xs font-mono border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 hover:border-purple-500/50 transition-colors"
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Tip $JTX
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onViewHistory?.(agent)}
              className="flex-1 h-8 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <Clock className="w-3 h-3 mr-1" />
              History
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
