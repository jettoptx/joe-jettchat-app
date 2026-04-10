"use client";

import React from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Conversation {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  verified: boolean;
  isEncrypted: boolean;
  isAgent?: boolean;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
}

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const { id, name, username, avatarUrl, lastMessage, timestamp, unread, verified, isAgent } =
    conversation;

  return (
    <Link
      href={`/chat/${id}`}
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors border-b border-border/50",
        isActive
          ? isAgent
            ? "bg-purple-500/8 border-r-2 border-r-purple-500"
            : "bg-primary/8 border-r-2 border-r-primary"
          : "hover:bg-secondary/50",
        isAgent && !isActive && "border-l-2 border-l-purple-500/30"
      )}
    >
      {/* Avatar */}
      <Avatar
        className={cn(
          "w-10 h-10 shrink-0 mt-0.5",
          isAgent && "border border-purple-500/30"
        )}
      >
        <AvatarImage src={avatarUrl} />
        <AvatarFallback
          className={cn(
            "text-sm font-mono",
            isAgent
              ? "bg-purple-500/15 text-purple-300"
              : "bg-primary/15 text-primary"
          )}
        >
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-sm truncate",
              unread ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}
          >
            {name}
          </span>
          {/* Agent bot icon */}
          {isAgent && (
            <Bot className="w-3 h-3 text-purple-400 shrink-0" aria-label="Agent" />
          )}
          {verified && !isAgent && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/25"
            >
              ✓
            </Badge>
          )}
          {isAgent && (
            <Badge className="h-4 px-1 text-[8px] bg-purple-500/15 text-purple-400 border-purple-500/25 font-mono">
              AGENT
            </Badge>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground font-mono shrink-0">
            {timestamp}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p
            className={cn(
              "text-xs truncate",
              unread ? "text-foreground/80" : "text-muted-foreground"
            )}
          >
            {lastMessage}
          </p>
          {unread && (
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isAgent ? "bg-purple-500" : "bg-primary"
              )}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
