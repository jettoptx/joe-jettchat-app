"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { ConversationList } from "@/components/chat/ConversationList";

interface ChatLayoutProps {
  children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <>
      {/* NavRail — 68px */}
      <Sidebar />

      {/* ConversationList — 320px */}
      <ConversationList />

      {/* Active thread or empty state — flex-1 */}
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </>
  );
}
