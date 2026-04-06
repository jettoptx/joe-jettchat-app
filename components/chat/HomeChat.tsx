"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, Mic, Pen } from "lucide-react";

const FILTER_PILLS = [
  "X Search",
  "Reddit",
  "Research",
  "Videos",
  "Fact Check",
];

export function HomeChat() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // TODO: Create thread via API, redirect to /chat/[id]
    const threadId = Date.now().toString(36);
    router.push(`/chat/${threadId}?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4">
      {/* Logo */}
      <div className="text-center">
        <h1 className="font-display text-5xl font-bold text-accent mb-2">
          JettChat
        </h1>
        <p className="text-text-secondary text-sm">
          Encrypted AI chat powered by OPTX
        </p>
      </div>

      {/* Model selector */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="font-mono text-accent">xI</span>
        <select className="bg-transparent text-text-primary border-none outline-none cursor-pointer">
          <option>Grok 4.1 Fast</option>
          <option>Grok 4.20</option>
          <option>Claude Opus 4.6</option>
        </select>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap justify-center">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill}
            onClick={() => setActiveFilter(activeFilter === pill ? null : pill)}
            className={`
              px-3 py-1.5 rounded-full text-sm transition-colors
              ${activeFilter === pill
                ? "bg-accent text-background font-medium"
                : "bg-card border border-border text-text-secondary hover:text-text-primary"
              }
            `}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="input-bar flex items-center gap-2">
          <button type="button" className="p-1.5 text-text-secondary hover:text-text-primary">
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent outline-none text-text-primary placeholder-text-muted"
          />
          <button type="button" className="p-1.5 text-text-secondary hover:text-text-primary">
            <Pen size={18} />
          </button>
          <button type="button" className="p-1.5 text-text-secondary hover:text-text-primary">
            <Mic size={18} />
          </button>
          <button
            type="submit"
            disabled={!query.trim()}
            className="p-1.5 text-accent hover:text-accent-muted disabled:text-text-muted transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
