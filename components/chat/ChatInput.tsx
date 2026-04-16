"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Smile, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SkillPicker } from "@/components/chat/SkillPicker";
import { findSkill, type Skill } from "@/lib/skills";
import type { ChatMessage } from "@/components/chat/MessageBubble";

interface ChatInputProps {
  onSend: (content: string) => void;
  /** Called with the agent ChatMessage produced by a skill execution */
  onSkillResult?: (message: ChatMessage) => void;
  disabled?: boolean;
  placeholder?: string;
  userId?: string;
  userTier?: "free" | "mojo" | "dojo";
}

export function ChatInput({
  onSend,
  onSkillResult,
  disabled = false,
  placeholder = "Start a new message",
  userId = "anonymous",
  userTier = "free",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  // SkillPicker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerIndex, setPickerIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Derive picker state from current value
  const updatePickerState = useCallback((raw: string) => {
    if (raw.startsWith("/")) {
      // Extract slug fragment after "/"
      const fragment = raw.slice(1).split(/\s/)[0];
      // Only show picker while the user is still typing the command token
      // (no space yet in the input, or exactly the "/" alone)
      const hasArgs = raw.includes(" ");
      if (!hasArgs) {
        setPickerQuery(fragment);
        setPickerOpen(true);
        setPickerIndex(0);
        return;
      }
    }
    setPickerOpen(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setValue(raw);
    updatePickerState(raw);
  };

  const handleSkillSelect = (skill: Skill) => {
    // Insert "/slug " into the input and close picker
    setValue(`/${skill.slug} `);
    setPickerOpen(false);
    inputRef.current?.focus();
  };

  const executeSkill = useCallback(
    async (input: string) => {
      const skill = findSkill(input);
      if (!skill) return false;

      setIsExecuting(true);
      try {
        const args = input.trim().slice(skill.slug.length + 1).trim();
        const res = await fetch("/api/skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill: skill.slug, args, userId }),
        });
        const data = (await res.json()) as { output?: string; error?: string };
        const output = data.output ?? data.error ?? "[No response]";
        const agentMsg: ChatMessage = {
          id: `skill-${skill.slug}-${Date.now()}`,
          role: "received",
          content: output,
          senderName:
            {
              hedgehog: "HEDGEHOG",
              traderjoe: "TraderJOE",
              optx: "OPTX",
              aaron: "AARON",
              joe: "JOE",
              local: "JettChat",
            }[skill.agentType] ?? "HERMES",
          timestamp: Date.now(),
          isAI: true,
        };
        onSkillResult?.(agentMsg);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Skill failed";
        onSkillResult?.({
          id: `skill-err-${Date.now()}`,
          role: "received",
          content: `[${skill.name}] error — ${message}`,
          senderName: "HEDGEHOG",
          timestamp: Date.now(),
          isAI: true,
        });
      } finally {
        setIsExecuting(false);
      }
      return true;
    },
    [userId, onSkillResult]
  );

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed || isExecuting) return;

    setValue("");
    setPickerOpen(false);

    // Skill command path
    if (trimmed.startsWith("/")) {
      const handled = await executeSkill(trimmed);
      if (handled) return;
    }

    // Normal message path
    onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (pickerOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPickerIndex((i) => i + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPickerIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPickerOpen(false);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        // Let SkillPicker handle selection via its current index — we emit
        // selection by triggering handleSkillSelect through a ref.
        // Simplified: close picker and leave value for user to complete.
        setPickerOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSkillMode = value.startsWith("/") && !value.includes(" ");
  const canSend = value.trim().length > 0 && !isExecuting;

  return (
    <div className="shrink-0 px-3 sm:px-4 pt-3 pb-3 safe-bottom border-t border-border bg-background/80 backdrop-blur-sm">
      {/* Relative wrapper so SkillPicker can position above the input */}
      <div ref={containerRef} className="relative w-full max-w-4xl mx-auto">
        {/* SkillPicker autocomplete */}
        {pickerOpen && (
          <SkillPicker
            query={pickerQuery}
            selectedIndex={pickerIndex}
            onSelect={handleSkillSelect}
            onClose={() => setPickerOpen(false)}
            onIndexChange={setPickerIndex}
          />
        )}

        <div className="flex items-center gap-1">
          {/* Attachment buttons — hidden on the narrowest screens to save horizontal space */}
          <button
            type="button"
            aria-label="Attach file"
            className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Paperclip className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Attach image"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ImageIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Insert emoji"
            className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Smile className="w-[18px] h-[18px]" />
          </button>

          {/* Input */}
          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={disabled || isExecuting}
              placeholder={
                isExecuting
                  ? "Executing skill..."
                  : placeholder
              }
              aria-label="Chat message input"
              aria-autocomplete="list"
              aria-expanded={pickerOpen}
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              className={cn(
                "w-full px-4 py-3 min-h-[44px] bg-secondary border border-border/50 rounded-full",
                // text-base (16px) on mobile prevents iOS Safari from auto-zooming on focus
                "text-base sm:text-sm font-mono text-foreground placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30",
                "disabled:opacity-40 transition-all",
                isSkillMode && "border-blue-500/30 ring-1 ring-blue-500/20"
              )}
            />
            {/* Skill mode indicator pill */}
            {isSkillMode && !isExecuting && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-blue-400/60 uppercase tracking-widest pointer-events-none">
                skill
              </span>
            )}
          </div>

          {/* Send / Executing */}
          <Button
            onClick={handleSubmit}
            disabled={disabled || !canSend}
            size="icon"
            className={cn(
              "w-11 h-11 rounded-full shrink-0",
              "bg-primary hover:bg-primary/90",
              "disabled:opacity-20 transition-all"
            )}
            aria-label={isExecuting ? "Executing skill" : "Send message"}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
