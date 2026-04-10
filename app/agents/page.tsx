"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { AgentDirectory } from "@/components/chat/AgentDirectory";
import { type AgentCardData } from "@/components/chat/AgentCard";

export default function AgentsPage() {
  const router = useRouter();

  function handleSelectAgent(agent: AgentCardData) {
    // Navigate to a DM conversation with the agent
    router.push(`/chat/${agent.id}`);
  }

  function handleTip(agent: AgentCardData) {
    // TODO: open $JTX tip modal — integrate with Solana wallet
    console.log("Tip agent:", agent.xHandle);
  }

  function handleViewHistory(agent: AgentCardData) {
    router.push(`/chat/${agent.id}`);
  }

  return (
    <ChatLayout>
      <AgentDirectory
        onSelectAgent={handleSelectAgent}
        onTip={handleTip}
        onViewHistory={handleViewHistory}
      />
    </ChatLayout>
  );
}
