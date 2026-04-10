"use client"

import { useState } from "react"
import { Search as SearchIcon, Users, MessageSquare, Hash } from "lucide-react"
import { ChatLayout } from "@/components/layout/ChatLayout"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const SEARCH_CATEGORIES = [
  { id: "all", label: "All", icon: SearchIcon },
  { id: "people", label: "People", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "channels", label: "Channels", icon: Hash },
]

const SUGGESTED_CHANNELS = [
  { slug: "$JTX", name: "Jett-Chat", members: 0, type: "public" },
  { slug: "#dojo", name: "DOJO", members: 0, type: "gated", gate: "444 JTX" },
  { slug: "#mojo", name: "MOJO", members: 0, type: "gated", gate: "12 JTX" },
]

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col bg-background">
        <div className="px-6 py-4 border-b border-border">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages, people, channels..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2 mt-3">
            {SEARCH_CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {!query && (
            <div className="px-6 py-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Channels</h3>
              <div className="space-y-2">
                {SUGGESTED_CHANNELS.map((ch) => (
                  <div
                    key={ch.slug}
                    className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-mono">
                        {ch.slug.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{ch.slug}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            ch.type === "gated" ? "border-amber-500/30 text-amber-400" : "border-green-500/30 text-green-400"
                          }`}
                        >
                          {ch.type === "gated" ? ch.gate : "PUBLIC"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{ch.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {query && (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              Search results will appear here
            </div>
          )}
        </ScrollArea>
      </div>
    </ChatLayout>
  )
}
