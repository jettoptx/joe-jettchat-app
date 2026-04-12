"use client";

import React from "react";

interface HeatmapTextProps {
  text: string;
  fontSize?: string;
  className?: string;
}

/**
 * Animated thermal/heatmap text effect using CSS gradient + background-clip.
 * Simulates a flowing orange thermal look through Orbitron letterforms.
 */
export function HeatmapText({
  text,
  fontSize = "2.75rem",
  className,
}: HeatmapTextProps) {
  return (
    <h1
      className={`heatmap-text ${className ?? ""}`}
      style={{
        fontFamily: "var(--font-display), Orbitron, sans-serif",
        fontSize,
        fontWeight: 800,
        letterSpacing: "0.15em",
        lineHeight: 1.1,
        background:
          "linear-gradient(135deg, #f97316, #ea580c, #fdba74, #fff7ed, #f97316, #ea580c, #fdba74)",
        backgroundSize: "300% 300%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {text}
    </h1>
  );
}
