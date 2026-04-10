"use client";

/**
 * AttestationBadge.tsx — Compact on-chain attestation status badge for the chat header.
 *
 * Displays live status of the Merkle-root attestation pipeline for gated channels
 * (#dojo, #mojo). Sits next to the E2E indicator in the ChatThread header bar.
 *
 * Status colours:
 *   idle     → gray
 *   building → amber
 *   pending  → orange pulse
 *   confirmed → green (briefly flashes, then settles)
 *   error    → red
 *
 * Luke 18:31
 */

import React, { useEffect, useState } from "react";
import { Shield, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AttestationStatus } from "@/hooks/useAttestation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttestationBadgeProps {
  status: AttestationStatus;
  pendingCount: number;
  /** Total batch size — used for the "N/50 messages" display */
  batchSize?: number;
  /** Solscan URL for the last confirmed tx */
  explorerUrl: string | null;
  /** Truncated tx signature for confirmed flash label */
  lastSignature: string | null;
  className?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  dot: string;
  label: string;
  animate?: boolean;
}

const STATUS_CONFIG: Record<AttestationStatus, StatusConfig> = {
  idle: {
    dot: "bg-muted-foreground/50",
    label: "On-chain",
  },
  building: {
    dot: "bg-amber-400",
    label: "Building",
  },
  pending: {
    dot: "bg-orange-400",
    label: "Pending",
    animate: true,
  },
  confirmed: {
    dot: "bg-emerald-400",
    label: "Confirmed",
  },
  error: {
    dot: "bg-destructive",
    label: "Error",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateSig(sig: string): string {
  if (sig.length <= 12) return sig;
  return `${sig.slice(0, 6)}…${sig.slice(-4)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttestationBadge({
  status,
  pendingCount,
  batchSize = 50,
  explorerUrl,
  lastSignature,
  className,
}: AttestationBadgeProps) {
  // Flash green briefly after a "confirmed" transition
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (status === "confirmed") {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2200);
      return () => clearTimeout(t);
    }
  }, [status, lastSignature]); // re-trigger on every new confirmed sig

  const cfg = STATUS_CONFIG[status];

  const tooltipLines: string[] = [
    "Messages are batched and attested on Solana",
    `${pendingCount} / ${batchSize} messages pending`,
  ];
  if (lastSignature) {
    tooltipLines.push(`Last tx: ${truncateSig(lastSignature)}`);
  }

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
        "border text-[9px] font-mono select-none transition-colors duration-500",
        flash
          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
          : "bg-secondary/60 border-border/50 text-muted-foreground",
        className
      )}
    >
      {/* Dot / spinner */}
      {status === "building" || status === "pending" ? (
        <Loader2
          className={cn(
            "w-2.5 h-2.5 shrink-0",
            status === "building" ? "text-amber-400 animate-spin" : "text-orange-400 animate-spin"
          )}
        />
      ) : (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            cfg.dot,
            cfg.animate && "animate-pulse"
          )}
        />
      )}

      {/* Shield icon */}
      <Shield className="w-2.5 h-2.5 shrink-0" />

      {/* Label — show pending count or "On-chain" */}
      {status === "idle" ? (
        <span>On-chain</span>
      ) : status === "confirmed" && flash && lastSignature ? (
        <span className="text-emerald-300">{truncateSig(lastSignature)}</span>
      ) : (
        <span>
          {pendingCount}/{batchSize}
        </span>
      )}

      {/* External link to Solscan — only when we have a tx */}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="View attestation on Solscan"
        >
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-[220px] text-[10px] leading-relaxed"
        >
          {tooltipLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
