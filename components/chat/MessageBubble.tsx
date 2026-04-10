"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AgentBadge, type AgentType, type X402Policy } from "./AgentBadge";

export interface ChatMessage {
  id: string;
  role: "sent" | "received" | "system";
  content: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: number;
  tensor?: "COG" | "EMO" | "ENV";
  isAI?: boolean;
  messageType?: "user" | "agent" | "joe" | "system";
  agentType?: AgentType;
  erc8002Score?: number;
  x402Policy?: X402Policy;
}

interface MessageBubbleProps {
  message: ChatMessage;
  showAvatar?: boolean;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tensorEmoji(t?: string) {
  if (t === "COG") return "🧠";
  if (t === "EMO") return "❤️";
  if (t === "ENV") return "🌍";
  return null;
}

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const {
    role,
    content,
    senderName,
    senderAvatar,
    timestamp,
    tensor,
    isAI,
    messageType,
    agentType,
    erc8002Score,
    x402Policy,
  } = message;
  const isSent = role === "sent";
  const isAgent = messageType === "agent" || messageType === "joe";

  return (
    <div className={cn("flex gap-2.5 px-4", isSent ? "justify-end" : "justify-start")}>
      {/* Receiver avatar */}
      {!isSent && showAvatar && (
        <Avatar
          className={cn(
            "w-8 h-8 mt-1 shrink-0",
            isAgent && "border border-purple-500/40"
          )}
        >
          <AvatarImage src={senderAvatar} />
          <AvatarFallback
            className={cn(
              "text-xs",
              isAgent
                ? "bg-purple-500/15 text-purple-300"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {senderName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      {!isSent && !showAvatar && <div className="w-8 shrink-0" />}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[70%] px-4 py-2.5",
          isSent
            ? "bg-primary/12 border border-primary/20 rounded-2xl rounded-br-sm"
            : isAgent
            ? "bg-purple-500/8 border border-purple-500/20 rounded-2xl rounded-bl-sm"
            : "bg-card border border-border rounded-2xl rounded-bl-sm"
        )}
      >
        {/* Sender meta */}
        {showAvatar && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={cn(
                "font-mono text-[10px] font-semibold",
                isSent
                  ? "text-primary"
                  : isAgent
                  ? "text-purple-400"
                  : "text-blue-400"
              )}
            >
              {senderName}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {formatTime(timestamp)}
            </span>
            {tensor && <span className="text-xs">{tensorEmoji(tensor)}</span>}
            {isAI && !isAgent && (
              <Badge className="bg-blue-500/10 text-blue-400/80 border-blue-500/20 text-[8px] h-3.5 px-1.5">
                AI
              </Badge>
            )}
            {isAgent && agentType && (
              <AgentBadge
                agentType={agentType}
                erc8002Score={erc8002Score ?? 0}
                x402Policy={x402Policy}
              />
            )}
          </div>
        )}

        {/* Message text */}
        <p
          className={cn(
            "font-mono text-xs leading-relaxed whitespace-pre-wrap",
            isAgent ? "text-purple-100/80" : "text-foreground/80"
          )}
        >
          {content}
        </p>

        {/* Timestamp (no avatar = grouped) */}
        {!showAvatar && (
          <span className="block text-right font-mono text-[9px] text-muted-foreground mt-1">
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
