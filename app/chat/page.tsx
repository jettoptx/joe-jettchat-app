import { ChatLayout } from "@/components/layout/ChatLayout";
import { MessageSquare } from "lucide-react";

/**
 * /chat — index page
 *
 * Renders the chat shell (NavRail + ConversationList) with an empty-state
 * placeholder where the active thread would be. Selecting a conversation in
 * the list pushes the user to /chat/[id], which renders the full thread.
 *
 * This page exists because:
 *  - The homepage redirects to /chat for authenticated users
 *  - Without this index, /chat would 404 (only /chat/[id] existed)
 */
export default function ChatIndexPage() {
  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-600/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center">
          <MessageSquare className="w-7 h-7 text-orange-400" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-mono tracking-wide">Pick a conversation</h1>
          <p className="text-sm text-white/40 font-mono max-w-xs">
            Select a thread on the left, or start a new encrypted DM with the
            <span className="text-orange-400"> + </span>
            button.
          </p>
        </div>
      </div>
    </ChatLayout>
  );
}
