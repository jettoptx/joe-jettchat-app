"use client";

import React, { useState } from "react";
import { Send, RotateCcw, Copy, Share2, Download, Volume2, Bookmark } from "lucide-react";

interface ChatThreadProps {
  threadId: string;
}

export function ChatThread({ threadId }: ChatThreadProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    // TODO: Send to HEDGEHOG/Grok API, stream response
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Streaming response..." },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-border">
        <div className="w-6 h-6 rounded-full bg-accent/20" />
        <h2 className="text-sm font-medium text-text-primary truncate">
          Thread {threadId}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[80%] px-4 py-3 rounded-xl text-sm ${
                msg.role === "user"
                  ? "bg-accent/20 text-text-primary"
                  : "bg-card border border-border text-text-primary"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center text-text-muted py-20">
            Start a conversation
          </div>
        )}
      </div>

      {/* Action bar (below assistant messages) */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 border-t border-border">
          {[RotateCcw, Bookmark, Copy, Volume2, Share2, Download].map(
            (Icon, i) => (
              <button
                key={i}
                className="p-1.5 text-text-muted hover:text-text-secondary transition-colors"
              >
                <Icon size={16} />
              </button>
            )
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-4">
        <form onSubmit={handleSubmit}>
          <div className="input-bar flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a follow-up..."
              className="flex-1 bg-transparent outline-none text-text-primary placeholder-text-muted text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-1.5 text-accent disabled:text-text-muted"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
