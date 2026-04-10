"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

/**
 * AugmentOverlay — fullscreen MOA overlay for JettChat.
 *
 * Toggle: dispatch CustomEvent "augment-space-toggle" on window
 * Close:  dispatch CustomEvent "augment-space-close" on window
 * ESC key closes the overlay.
 *
 * The Eye icon in the NavRail sidebar (components/layout/Sidebar.tsx)
 * should dispatch "augment-space-toggle" when clicked.
 *
 * Default: closed (false). Opens only on explicit toggle.
 */

const MoaVisual = dynamic(
  () => import("@/components/moa/MoaVisual").then((m) => ({ default: m.MoaVisual })),
  {
    ssr: false,
    loading: () => <div className="moa-fullscreen animate-pulse bg-background/80" />,
  }
);

export function AugmentOverlay() {
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Remove active glow from any augment-space-btn elements in the NavRail
    document.querySelectorAll(".augment-space-btn").forEach((btn) => {
      btn.classList.remove("augment-active");
    });
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      const btns = document.querySelectorAll(".augment-space-btn");
      btns.forEach((btn) => {
        if (next) {
          btn.classList.add("augment-active");
        } else {
          btn.classList.remove("augment-active");
        }
      });
      return next;
    });
  }, []);

  // Listen for toggle/close events from sidebar or other sources
  useEffect(() => {
    window.addEventListener("augment-space-toggle", handleToggle);
    window.addEventListener("augment-space-close", handleClose);
    return () => {
      window.removeEventListener("augment-space-toggle", handleToggle);
      window.removeEventListener("augment-space-close", handleClose);
    };
  }, [handleToggle, handleClose]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className="moa-overlay" role="dialog" aria-modal="true" aria-label="Map of Augments">
      {/* Close button — top-left corner */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-[70] flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground/50 hover:text-foreground transition-colors uppercase tracking-wider"
        aria-label="Close Map of Augments"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        ESC
      </button>

      {/* Header bar — top-right branding */}
      <div className="absolute top-4 right-4 z-[70] flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 pointer-events-none select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        MAP OF AUGMENTS
      </div>

      <MoaVisual />
    </div>
  );
}
