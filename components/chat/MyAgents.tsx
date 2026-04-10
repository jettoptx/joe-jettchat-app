"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Bot, Cpu, TrendingUp, Plug, Unplug, ExternalLink, Shield, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type AgentType = "joe" | "astrojoe" | "traderjoe" | "custom"
type AgentStatus = "online" | "offline" | "syncing"

const AGENT_TYPE_CONFIG: Record<AgentType, { icon: typeof Bot; label: string; color: string }> = {
  joe: { icon: Bot, label: "JOE", color: "text-purple-400" },
  astrojoe: { icon: Cpu, label: "AstroJOE", color: "text-purple-300" },
  traderjoe: { icon: TrendingUp, label: "TraderJOE", color: "text-amber-400" },
  custom: { icon: Bot, label: "Custom", color: "text-blue-400" },
}

function getTrustColor(score: number) {
  if (score >= 86) return "text-green-400 bg-green-500/20"
  if (score >= 61) return "text-blue-400 bg-blue-500/20"
  if (score >= 31) return "text-amber-400 bg-amber-500/20"
  return "text-red-400 bg-red-500/20"
}

function getStatusConfig(status: AgentStatus) {
  switch (status) {
    case "online": return { dot: "bg-green-500", label: "Online", icon: Plug }
    case "syncing": return { dot: "bg-amber-500 animate-pulse", label: "Syncing", icon: Plug }
    case "offline": return { dot: "bg-zinc-500", label: "Offline", icon: Unplug }
  }
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function MyAgents() {
  const agents = useQuery(api.agents.listActive)

  const activeCount = agents?.filter(a => (a.status ?? "offline") !== "offline").length ?? 0

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Bot className="w-4 h-4" />
            My Agents
          </h3>
          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
            {agents === undefined ? "..." : `${activeCount} active`}
          </Badge>
        </div>

        {agents === undefined && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">Loading agents...</span>
          </div>
        )}

        {agents?.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No agents yet</p>
            <p className="text-[10px] mt-1">Earn $OPTX to spawn your first averageJOE</p>
          </div>
        )}

        {agents?.map((agent) => {
          const agentType = (agent.agentType as AgentType) ?? "custom"
          const typeConfig = AGENT_TYPE_CONFIG[agentType] ?? AGENT_TYPE_CONFIG.custom
          const TypeIcon = typeConfig.icon
          const status: AgentStatus = (agent.status as AgentStatus) ?? "offline"
          const statusConfig = getStatusConfig(status)
          const StatusIcon = statusConfig.icon
          const trustScore = agent.erc8002Score ?? 0
          const capabilities = agent.capabilities ?? []
          const lastSeen = agent.lastSeenAt ?? agent.updatedAt ?? agent.createdAt

          return (
            <div
              key={agent._id}
              className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-purple-500/30 transition-colors cursor-pointer group"
            >
              {/* Agent avatar */}
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-purple-500/20 text-purple-400 text-xs font-mono">
                    <TypeIcon className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${statusConfig.dot}`} />
              </div>

              {/* Agent info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{agent.displayName ?? agent.xHandle}</span>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-purple-500/30 text-purple-400"
                  >
                    AGENT
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {statusConfig.label} · {timeAgo(lastSeen)}
                  </span>
                </div>
              </div>

              {/* Trust score */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono ${getTrustColor(trustScore)}`}>
                    <Shield className="w-3 h-3" />
                    {trustScore}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">ERC-8002 Trust Score</p>
                  <p className="text-[10px] text-muted-foreground">
                    {capabilities.length > 0
                      ? capabilities.map(c => `/${c}`).join(", ")
                      : "No capabilities registered"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}

        {/* Link to full directory */}
        <a
          href="/agents"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-purple-400 transition-colors py-2"
        >
          View Agent Directory
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </TooltipProvider>
  )
}
