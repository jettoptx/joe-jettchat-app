import { ChatLayout } from "@/components/layout/ChatLayout";
import { MessageSquare, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <ChatLayout>
      {/* Empty state — no conversation selected */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
          <MessageSquare className="w-10 h-10 text-primary/40" />
        </div>
        <h2 className="text-xl font-semibold mb-1">Select a message</h2>
        <p className="text-sm text-muted-foreground max-w-xs text-center">
          Choose from your existing conversations or start a new one.
        </p>
        <div className="flex items-center gap-1.5 mt-4 text-muted-foreground/50">
          <Shield className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px]">End-to-end encrypted</span>
        </div>
      </div>
    </ChatLayout>
  );
}
