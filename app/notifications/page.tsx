"use client"

import { Bell, Shield, UserPlus, MessageSquare, Eye } from "lucide-react"
import { ChatLayout } from "@/components/layout/ChatLayout"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface Notification {
  id: string
  type: "message_request" | "e2e_verified" | "agent_update" | "gaze_auth" | "channel_invite"
  title: string
  description: string
  timestamp: number
  read: boolean
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "message_request",
    title: "New message request",
    description: "Sigil Wen wants to send you a message",
    timestamp: Date.now() - 1000 * 60 * 12,
    read: false,
  },
  {
    id: "2",
    type: "e2e_verified",
    title: "E2E encryption verified",
    description: "Your TKDF key exchange with Joshua Jett is now active",
    timestamp: Date.now() - 1000 * 60 * 45,
    read: false,
  },
  {
    id: "3",
    type: "agent_update",
    title: "AstroJOE update",
    description: "Agent completed OPTX staking validation — 444 JTX confirmed",
    timestamp: Date.now() - 1000 * 60 * 120,
    read: true,
  },
  {
    id: "4",
    type: "gaze_auth",
    title: "Gaze authentication",
    description: "New device authenticated via JETT gaze biometrics",
    timestamp: Date.now() - 1000 * 60 * 60 * 6,
    read: true,
  },
  {
    id: "5",
    type: "channel_invite",
    title: "Channel invite",
    description: "You've been invited to #dojo — requires 444 JTX stake",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    read: true,
  },
]

function getIcon(type: Notification["type"]) {
  switch (type) {
    case "message_request": return <UserPlus className="w-5 h-5 text-primary" />
    case "e2e_verified": return <Shield className="w-5 h-5 text-green-500" />
    case "agent_update": return <MessageSquare className="w-5 h-5 text-blue-400" />
    case "gaze_auth": return <Eye className="w-5 h-5 text-primary" />
    case "channel_invite": return <Bell className="w-5 h-5 text-amber-400" />
  }
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function NotificationsPage() {
  const unread = MOCK_NOTIFICATIONS.filter((n) => !n.read).length

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Notifications</h1>
            {unread > 0 && (
              <Badge variant="default" className="bg-primary text-primary-foreground text-xs px-2">
                {unread} new
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {MOCK_NOTIFICATIONS.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 px-6 py-4 transition-colors hover:bg-card/50 cursor-pointer ${
                  !notification.read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border">
                    {getIcon(notification.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${!notification.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {notification.description}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 mt-1">
                  {timeAgo(notification.timestamp)}
                </span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="px-6 py-8 text-center text-muted-foreground text-sm">
            End-to-end encrypted notifications
          </div>
        </ScrollArea>
      </div>
    </ChatLayout>
  )
}
