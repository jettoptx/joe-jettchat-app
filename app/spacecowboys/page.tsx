import { ChatLayout } from "@/components/layout/ChatLayout";
import { MessageSquare } from "lucide-react";

/**
 * /spacecowboys — JettChat app home (post-login landing)
 *
 * This is the canonical URL for the JettChat native app surface — the
 * Space Cowboys community is the JettOptics group, so the URL doubles as
 * the brand/identity. Renders the standard ChatLayout (NavRail +
 * ConversationList) with a friendly empty-state placeholder where the
 * active thread would be.
 *
 * Pick a thread on the left → push to /chat/[id] for the full thread.
 */
export default function SpaceCowboysPage() {
  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-600/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center">
          <MessageSquare className="w-7 h-7 text-orange-400" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-mono tracking-wide">
            Welcome, Space Cowboy
          </h1>
          <p className="text-sm text-white/40 font-mono max-w-xs">
            Pick a conversation on the left, or start a new encrypted DM with
            the
            <span className="text-orange-400"> + </span>
            button.
          </p>
        </div>
      </div>
    </ChatLayout>
  );
}
