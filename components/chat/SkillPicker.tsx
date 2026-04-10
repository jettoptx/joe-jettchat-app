"use client";

/**
 * components/chat/SkillPicker.tsx — slash-command autocomplete dropdown
 *
 * Renders when the user types "/" in ChatInput. Filters the skill registry
 * as the user types and allows keyboard + mouse selection.
 */

import React, { useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { filterSkills, type Skill, type SkillCategory } from "@/lib/skills";

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<
  SkillCategory,
  { badge: string; dot: string }
> = {
  crypto: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  trading: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400",
  },
  gaze: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dot: "bg-orange-400",
  },
  system: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dot: "bg-blue-400",
  },
  search: {
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dot: "bg-cyan-400",
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillPickerProps {
  /** The text the user has typed after "/" — e.g. "gr" for "/gr" */
  query: string;
  /** Currently highlighted index */
  selectedIndex: number;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
  /** Controlled via parent for keyboard navigation */
  onIndexChange: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillPicker({
  query,
  selectedIndex,
  onSelect,
  onClose,
  onIndexChange,
}: SkillPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const skills = filterSkills(query);

  // Clamp selectedIndex whenever the filtered list changes
  useEffect(() => {
    if (skills.length === 0) {
      onClose();
      return;
    }
    if (selectedIndex >= skills.length) {
      onIndexChange(skills.length - 1);
    }
  }, [skills.length, selectedIndex, onIndexChange, onClose]);

  // Scroll active item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (skills.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-2 mx-4",
        "bg-card border border-border rounded-xl shadow-2xl shadow-black/40",
        "overflow-hidden z-50"
      )}
      role="listbox"
      aria-label="Available skills"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          HERMES Skills
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {skills.length} match{skills.length !== 1 ? "es" : ""}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/40">
          ↑↓ navigate · ↵ select · esc close
        </span>
      </div>

      <ScrollArea className="max-h-64">
        <div className="py-1">
          {skills.map((skill, i) => {
            const styles = CATEGORY_STYLES[skill.category];
            const isActive = i === selectedIndex;

            return (
              <button
                key={skill.slug}
                ref={(el) => { itemRefs.current[i] = el; }}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => onIndexChange(i)}
                onClick={() => onSelect(skill)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  "focus:outline-none",
                  isActive
                    ? "bg-secondary/70"
                    : "hover:bg-secondary/40"
                )}
              >
                {/* Category dot */}
                <span
                  className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)}
                  aria-hidden
                />

                {/* Command token */}
                <span className="font-mono text-xs text-foreground font-semibold w-20 shrink-0">
                  /{skill.slug}
                </span>

                {/* Description */}
                <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
                  {skill.description}
                </span>

                {/* Category badge */}
                <Badge
                  variant="outline"
                  className={cn("font-mono text-[9px] h-4 px-1.5 shrink-0", styles.badge)}
                >
                  {skill.category}
                </Badge>

                {/* Tier gate indicator */}
                {skill.requiresTier && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[9px] h-4 px-1.5 shrink-0 bg-purple-500/10 text-purple-400 border-purple-500/20"
                  >
                    {skill.requiresTier.toUpperCase()}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
