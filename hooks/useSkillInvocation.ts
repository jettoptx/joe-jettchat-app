"use client";

/**
 * hooks/useSkillInvocation.ts — Hermes skill execution hook
 *
 * Parses slash commands, validates tier access, POSTs to /api/skill,
 * and returns results as agent messages for injection into the chat thread.
 */

import { useState, useCallback } from "react";
import { findSkill, extractSkillArgs, type Skill } from "@/lib/skills";
import type { ChatMessage } from "@/components/chat/MessageBubble";

export interface SkillResult {
  skill: Skill;
  args: string;
  output: string;
  metadata?: Record<string, unknown>;
  executedAt: number;
}

export interface UseSkillInvocationOptions {
  userId?: string;
  userTier?: "free" | "mojo" | "dojo";
}

export interface UseSkillInvocationReturn {
  /** Call with the raw input string; returns an agent ChatMessage or null on skip */
  invokeSkill: (input: string) => Promise<ChatMessage | null>;
  isExecuting: boolean;
  lastResult: SkillResult | null;
  error: string | null;
  /** Returns true when the input is a recognised slash command */
  isSkillCommand: (input: string) => boolean;
}

const TIER_RANK: Record<string, number> = {
  free: 0,
  mojo: 1,
  dojo: 2,
};

function meetsRequirement(
  userTier: string,
  required?: string | null
): boolean {
  if (!required) return true;
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[required] ?? 0);
}

export function useSkillInvocation({
  userId = "anonymous",
  userTier = "free",
}: UseSkillInvocationOptions = {}): UseSkillInvocationReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<SkillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSkillCommand = useCallback((input: string) => {
    return input.trim().startsWith("/") && findSkill(input) !== null;
  }, []);

  const invokeSkill = useCallback(
    async (input: string): Promise<ChatMessage | null> => {
      const skill = findSkill(input);
      if (!skill) return null;

      const args = extractSkillArgs(input);

      // Tier gate
      if (!meetsRequirement(userTier, skill.requiresTier)) {
        const gateMsg: ChatMessage = {
          id: `skill-gate-${Date.now()}`,
          role: "received",
          content: `[${skill.name}] requires the ${skill.requiresTier?.toUpperCase()} tier. Upgrade at jettoptx.chat/pricing to unlock this skill.`,
          senderName: "HEDGEHOG",
          timestamp: Date.now(),
          isAI: true,
        };
        setError(`Tier requirement not met: ${skill.requiresTier}`);
        return gateMsg;
      }

      setIsExecuting(true);
      setError(null);

      try {
        const res = await fetch("/api/skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: skill.slug, args, userId }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "Unknown error");
          throw new Error(`Skill API error ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as {
          output: string;
          metadata?: Record<string, unknown>;
        };

        const result: SkillResult = {
          skill,
          args,
          output: data.output,
          metadata: data.metadata,
          executedAt: Date.now(),
        };
        setLastResult(result);

        const agentMessage: ChatMessage = {
          id: `skill-${skill.slug}-${Date.now()}`,
          role: "received",
          content: data.output,
          senderName: resolveAgentName(skill.agentType),
          timestamp: Date.now(),
          isAI: true,
        };

        return agentMessage;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Skill execution failed";
        setError(message);

        const errorMessage: ChatMessage = {
          id: `skill-err-${Date.now()}`,
          role: "received",
          content: `[${skill.name}] failed — ${message}`,
          senderName: "HEDGEHOG",
          timestamp: Date.now(),
          isAI: true,
        };
        return errorMessage;
      } finally {
        setIsExecuting(false);
      }
    },
    [userId, userTier]
  );

  return { invokeSkill, isExecuting, lastResult, error, isSkillCommand };
}

function resolveAgentName(agentType: string): string {
  const names: Record<string, string> = {
    hedgehog: "HEDGEHOG",
    traderjoe: "TraderJOE",
    optx: "OPTX",
    aaron: "AARON",
    joe: "JOE",
    local: "JettChat",
  };
  return names[agentType] ?? "HERMES";
}
