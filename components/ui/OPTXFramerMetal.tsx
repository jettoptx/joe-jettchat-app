"use client";

import React from "react";
import { LiquidMetal } from "@paper-design/shaders-react";

interface OPTXFramerMetalProps {
  /** Container size class (Tailwind), default "w-44 h-44" */
  size?: string;
  /** Additional className for the wrapper */
  className?: string;
  /** LiquidMetal speed, default 0.6 */
  speed?: number;
  /** LiquidMetal tint color, default "#ff991e" (OPTX amber) */
  colorTint?: string;
  /** LiquidMetal background color, default "#000000" */
  colorBack?: string;
}

/**
 * OPTXFramerMetal — Reusable OPTX Zia cross logo with LiquidMetal WebGL shader.
 *
 * Renders the Zia cross in animated liquid metal with thermal amber colors,
 * and a silver/metallic overlay on the top-left dot (matching official branding).
 *
 * Requires:
 *   - /public/optx-logo-mask.png (white-on-transparent Zia cross mask, 1024x1024)
 *   - @paper-design/shaders-react (LiquidMetal component)
 *
 * Usage:
 *   <OPTXFramerMetal />
 *   <OPTXFramerMetal size="w-56 h-56" speed={0.3} />
 */
export function OPTXFramerMetal({
  size = "w-44 h-44",
  className = "",
  speed = 0.6,
  colorTint = "#ff991e",
  colorBack = "#000000",
}: OPTXFramerMetalProps) {
  return (
    <div
      className={`${size} relative ${className}`}
      style={{
        WebkitMaskImage: "radial-gradient(circle at center, black 35%, transparent 60%)",
        maskImage: "radial-gradient(circle at center, black 35%, transparent 60%)",
      }}
    >
      <LiquidMetal
        image="/optx-logo-mask.png"
        style={{ width: "100%", height: "100%", background: "transparent" }}
        colorBack={colorBack}
        colorTint={colorTint}
        speed={speed}
        distortion={0.08}
        repetition={2.5}
        shiftRed={0.5}
        shiftBlue={0.6}
        contour={0.35}
        softness={0.15}
        angle={60}
        shape="none"
      />
      {/* Silver/metallic overlay on top-left dot */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: "38%",
          left: "38%",
          width: "12%",
          height: "12%",
          background:
            "radial-gradient(ellipse at 38% 38%, #e8e8ef, #b0b0bc 40%, #8a8a9a 70%, #6e6e7e)",
          mixBlendMode: "color",
        }}
      />
    </div>
  );
}
