"use client";

import React, { useState, useMemo, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Region =
  | "yellow"
  | "blue"
  | "red"
  | "yellowBlue"
  | "blueRed"
  | "redYellow"
  | "center";

interface JettKeypadProps {
  /** Current placement of numbers in regions */
  placedNumbers: Record<Region, number[]>;
  /** Called when user taps a number to move it to center */
  onNumberTap?: (num: number, fromRegion: Region) => void;
  /** Callback when all 10 digits are placed in center */
  onComplete?: (sequence: number[]) => void;
  /** Whether gaze tracking is active */
  gazeActive?: boolean;
  /** Score to display */
  score?: number;
  /** Size class */
  size?: "sm" | "md" | "lg";
  className?: string;
}

// ── Default placement ────────────────────────────────────────────────────────

export const DEFAULT_PLACEMENT: Record<Region, number[]> = {
  yellow: [1],
  blue: [9],
  red: [5],
  yellowBlue: [3],
  blueRed: [2, 8],
  redYellow: [4, 7],
  center: [6],
};

// ── Color palette ────────────────────────────────────────────────────────────

const COLORS = {
  yellow: { stroke: "#eab308", fill: "rgba(234,179,8,0.08)", text: "#eab308", bg: "#eab308" },
  blue:   { stroke: "#3b82f6", fill: "rgba(59,130,246,0.08)", text: "#60a5fa", bg: "#3b82f6" },
  red:    { stroke: "#ef4444", fill: "rgba(239,68,68,0.08)",  text: "#f87171", bg: "#ef4444" },
};

// ── Number ball positions (SVG viewBox 400x450) ──────────────────────────────

const REGION_POSITIONS: Record<Region, { x: number; y: number }[]> = {
  yellow:     [{ x: 200, y: 100 }],
  blue:       [{ x: 320, y: 290 }],
  red:        [{ x: 80,  y: 290 }],
  yellowBlue: [{ x: 290, y: 190 }, { x: 310, y: 220 }],
  blueRed:    [{ x: 160, y: 340 }, { x: 200, y: 360 }],
  redYellow:  [{ x: 110, y: 190 }, { x: 90,  y: 220 }],
  center:     [{ x: 200, y: 265 }],
};

function getColor(region: Region): string {
  if (region === "center") return "#f97316";
  if (region.startsWith("yellow")) return COLORS.yellow.bg;
  if (region.startsWith("blue")) return COLORS.blue.bg;
  if (region.startsWith("red")) return COLORS.red.bg;
  return "#f97316";
}

function getTextColor(region: Region): string {
  return "#ffffff";
}

// ── Component ────────────────────────────────────────────────────────────────

export function JettKeypad({
  placedNumbers,
  onNumberTap,
  onComplete,
  gazeActive = false,
  score = 320690,
  size = "lg",
  className = "",
}: JettKeypadProps) {
  const centerCount = placedNumbers.center?.length || 0;
  const strength = centerCount / 10;
  const starCount = Math.ceil(strength * 5);

  const sizeClass = size === "sm" ? "max-w-xs" : size === "md" ? "max-w-md" : "";

  // Flatten all numbers with their positions
  const balls = useMemo(() => {
    const result: Array<{
      num: number;
      region: Region;
      x: number;
      y: number;
      color: string;
    }> = [];

    for (const [region, nums] of Object.entries(placedNumbers)) {
      const positions = REGION_POSITIONS[region as Region] || [{ x: 200, y: 265 }];
      nums.forEach((num, idx) => {
        const pos = positions[Math.min(idx, positions.length - 1)];
        // Offset if multiple numbers share same position
        const offset = idx >= positions.length ? (idx - positions.length + 1) * 28 : 0;
        result.push({
          num,
          region: region as Region,
          x: pos.x + offset,
          y: pos.y,
          color: getColor(region as Region),
        });
      });
    }
    return result;
  }, [placedNumbers]);

  return (
    <div className={`${sizeClass} w-full mx-auto ${className}`}>
      {/* Score display */}
      <div className="flex justify-between items-center mb-3 px-2">
        <span className="text-orange-400/80 font-mono text-xs tracking-[3px] uppercase">
          Jett Keypad
        </span>
        <div className="font-mono text-2xl font-bold text-white tracking-[4px]">
          {score.toString().split("").map((d, i) => (
            <span
              key={i}
              className={`inline-block w-8 text-center border border-white/20 rounded mx-0.5 ${
                i === 0 ? "border-blue-500/50 text-blue-400" : "text-white/80"
              }`}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Venn diagram */}
      <div className="relative bg-zinc-950/80 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
        {/* Gaze indicator */}
        {gazeActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-[10px] font-mono rounded-full animate-pulse border border-red-500/30">
              LIVE GAZE
            </span>
          </div>
        )}

        <svg viewBox="0 0 400 450" className="w-full drop-shadow-2xl">
          {/* Gradient definitions */}
          <defs>
            <radialGradient id="yellowGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={COLORS.yellow.stroke} stopOpacity="0.15" />
              <stop offset="100%" stopColor={COLORS.yellow.stroke} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="redGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={COLORS.red.stroke} stopOpacity="0.15" />
              <stop offset="100%" stopColor={COLORS.red.stroke} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={COLORS.blue.stroke} stopOpacity="0.15" />
              <stop offset="100%" stopColor={COLORS.blue.stroke} stopOpacity="0" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines (subtle) */}
          {Array.from({ length: 20 }).map((_, i) => (
            <React.Fragment key={`grid-${i}`}>
              <line
                x1={i * 20}
                y1="0"
                x2={i * 20}
                y2="450"
                stroke="white"
                strokeOpacity="0.03"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1={i * 22.5}
                x2="400"
                y2={i * 22.5}
                stroke="white"
                strokeOpacity="0.03"
                strokeWidth="0.5"
              />
            </React.Fragment>
          ))}

          {/* Circle fills (subtle glow) */}
          <circle cx="200" cy="140" r="110" fill="url(#yellowGlow)" />
          <circle cx="110" cy="290" r="110" fill="url(#redGlow)" />
          <circle cx="290" cy="290" r="110" fill="url(#blueGlow)" />

          {/* Circle outlines */}
          <circle
            cx="200"
            cy="140"
            r="110"
            fill="none"
            stroke={COLORS.yellow.stroke}
            strokeWidth="2"
            strokeOpacity="0.7"
            filter="url(#glow)"
          />
          <circle
            cx="110"
            cy="290"
            r="110"
            fill="none"
            stroke={COLORS.red.stroke}
            strokeWidth="2"
            strokeOpacity="0.7"
            filter="url(#glow)"
          />
          <circle
            cx="290"
            cy="290"
            r="110"
            fill="none"
            stroke={COLORS.blue.stroke}
            strokeWidth="2"
            strokeOpacity="0.7"
            filter="url(#glow)"
          />

          {/* Center Jett triangle */}
          <polygon
            points="200,240 188,260 212,260"
            fill="#f97316"
            fillOpacity="0.9"
            filter="url(#glow)"
          />

          {/* Number balls */}
          {balls.map(({ num, region, x, y, color }) => (
            <g
              key={`ball-${num}`}
              style={{ cursor: region !== "center" ? "pointer" : "default" }}
              onClick={() => {
                if (region !== "center" && onNumberTap) {
                  onNumberTap(num, region);
                }
              }}
            >
              {/* Ball glow */}
              <circle cx={x} cy={y} r="18" fill={color} fillOpacity="0.2" />
              {/* Ball */}
              <circle
                cx={x}
                cy={y}
                r="14"
                fill={color}
                stroke={region === "center" ? "#f97316" : color}
                strokeWidth="1.5"
                strokeOpacity="0.8"
              />
              {/* Number text */}
              <text
                x={x}
                y={y + 5}
                fill="white"
                fontSize="14"
                fontWeight="700"
                textAnchor="middle"
                style={{ pointerEvents: "none", fontFamily: "monospace" }}
              >
                {num}
              </text>
            </g>
          ))}

          {/* Outer anchor dots */}
          <circle cx="200" cy="20" r="18" fill={COLORS.yellow.bg} fillOpacity="0.9" filter="url(#glow)" />
          <circle cx="20" cy="400" r="18" fill={COLORS.red.bg} fillOpacity="0.9" filter="url(#glow)" />
          <circle cx="380" cy="400" r="18" fill={COLORS.blue.bg} fillOpacity="0.9" filter="url(#glow)" />

          {/* Zero at bottom center */}
          <g>
            <circle cx="200" cy="430" r="14" fill="#7c3aed" fillOpacity="0.9" filter="url(#glow)" />
            <text
              x="200"
              y="435"
              fill="white"
              fontSize="14"
              fontWeight="700"
              textAnchor="middle"
              style={{ fontFamily: "monospace" }}
            >
              0
            </text>
          </g>
        </svg>
      </div>

      {/* Star progress */}
      <div className="flex justify-center gap-2 mt-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-2xl transition-all duration-300 ${
              star <= starCount
                ? "text-orange-400 drop-shadow-[0_0_8px_rgb(249,115,22)]"
                : "text-white/15"
            }`}
          >
            ★
          </span>
        ))}
      </div>
      <div className="text-center text-[10px] text-white/40 mt-1 font-mono tracking-widest">
        SIGNATURE STRENGTH: {Math.round(strength * 100)}%
      </div>
    </div>
  );
}
