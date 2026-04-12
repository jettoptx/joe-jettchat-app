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
          "linear-gradient(135deg, #11206a, #1f3ba2, #2f63e7, #6bd7ff, #ffe679, #ff991e, #ff4c00, #ff991e, #6bd7ff, #2f63e7, #1f3ba2, #11206a)",
        backgroundSize: "400% 400%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {text}
    </h1>
  );
}
