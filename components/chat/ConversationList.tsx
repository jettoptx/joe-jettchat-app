"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, SquarePen, Shield } from "lucide-react";
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

// Mock data — replaced by Convex in Phase 3
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "josh-jett",
    name: "Joshua Jett",
    username: "spac_wby_actual",
    lastMessage: "omg joe is that you?>",
    timestamp: "2m",
    unread: true,
    verified: true,
    isEncrypted: true,
  },
  {
    id: "noah-network",
    name: "Plena → Noah Network",
    username: "NoahAINetwork",
    lastMessage: "we also support OpenClaw, if you want to run agent workflows",
    timestamp: "Mar 22",
    unread: false,
    verified: true,
    isEncrypted: true,
  },
  {
    id: "sohom-1",
    name: "Sohom",
    username: "sohom_dev",
    lastMessage: "You accepted this message request",
    timestamp: "3w",
    unread: false,
    verified: true,
    isEncrypted: false,
  },
  {
    id: "sigil-wen",
    name: "Sigil Wen",
    username: "sigilwen",
    lastMessage: "You: shoot my founder account a invite",
    timestamp: "5w",
    unread: false,
    verified: true,
    isEncrypted: false,
  },
  {
    id: "compustable",
    name: "Compustable",
    username: "compustable",
    lastMessage: 'You reacted 🤩 to "wow - great Jett..."',
    timestamp: "5w",
    unread: false,
    verified: true,
    isEncrypted: false,
  },
  {
    id: "assure-defi",
    name: "Assure DeFi",
    username: "AssureDeFi",
    lastMessage: "Sending a message now",
    timestamp: "5w",
    unread: false,
    verified: true,
    isEncrypted: false,
  },
];

const FILTERS = ["All", "Unread", "Direct", "Groups", "Requests"] as const;

export function ConversationList() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("All");

  const activeConvoId = pathname.startsWith("/chat/")
    ? pathname.split("/chat/")[1]
    : null;

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
    }
    if (filter === "Unread") return c.unread;
    return true;
  });

  return (
    <div className="flex flex-col h-full w-[320px] border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">Messages</h2>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={0}>
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

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {filtered.map((convo) => (
          <ConversationItem
            key={convo.id}
            conversation={convo}
            isActive={activeConvoId === convo.id}
          />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Shield className="w-10 h-10 text-primary/30 mb-3" />
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        )}

        {/* My Agents section */}
        <div className="px-3 py-3">
          <Separator className="mb-3" />
          <MyAgents />
        </div>
      </ScrollArea>
    </div>
  );
}
