"use client";

import React from "react";
import { Shield, UserCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeType = "e2e" | "request_accepted" | "info";

interface SystemNoticeProps {
  type: NoticeType;
  message?: string;
}

const ICONS = {
  e2e: Shield,
  request_accepted: UserCheck,
  info: Lock,
};

const DEFAULTS: Record<NoticeType, string> = {
  e2e: "This conversation is now end-to-end encrypted",
  request_accepted: "You accepted this message request",
  info: "",
};

export function SystemNotice({ type, message }: SystemNoticeProps) {
  const Icon = ICONS[type];
  const text = message || DEFAULTS[type];

  return (
    <div className="flex justify-center py-3 px-4">
      <div
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-secondary/60 border border-border/50"
        )}
      >
        <Icon
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            type === "e2e" ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span className="font-mono text-[11px] text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}
