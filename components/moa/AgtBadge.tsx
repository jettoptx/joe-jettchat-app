"use client";

const AGT_COLORS = {
  COG: "#eab308",
  EMO: "#f43f5e",
  ENV: "#60a5fa",
} as const;

type Tensor = "COG" | "EMO" | "ENV";

/**
 * AGT tensor badge with tri-color distribution bar.
 * Shows primary tensor label + percentage breakdown bar (largest first).
 * JettChat adaptation: no Link dependency, uses JettChat theme tokens.
 */
export function AgtBadge({
  tensor,
  node,
  emo = 0,
  env = 0,
  cog = 0,
  onViewInMoa,
}: {
  tensor: Tensor;
  node: string;
  emo?: number;
  env?: number;
  cog?: number;
  /** Optional callback — fires the augment-space-toggle event to open MOA */
  onViewInMoa?: () => void;
}) {
  const color = AGT_COLORS[tensor];

  // Sort segments largest first for the bar
  const segments = ([
    { label: "COG" as Tensor, pct: cog, color: AGT_COLORS.COG },
    { label: "EMO" as Tensor, pct: emo, color: AGT_COLORS.EMO },
    { label: "ENV" as Tensor, pct: env, color: AGT_COLORS.ENV },
  ] as { label: Tensor; pct: number; color: string }[]).sort((a, b) => b.pct - a.pct);

  const hasDistribution = emo + env + cog > 0;

  const handleViewInMoa = () => {
    if (onViewInMoa) {
      onViewInMoa();
    } else {
      window.dispatchEvent(new CustomEvent("augment-space-toggle"));
    }
  };

  return (
    <div className="flex flex-col gap-1.5 mt-1 mb-3">
      {/* Primary tensor label */}
      <button
        onClick={handleViewInMoa}
        className="inline-flex items-center gap-1.5 no-underline group text-left"
        data-moa-node={node}
      >
        <span
          className="inline-block w-3 h-3 rounded-full transition-shadow group-hover:shadow-lg"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}66`,
          }}
        />
        <span
          className="text-xs font-bold font-display tracking-widest uppercase transition-colors"
          style={{ color }}
        >
          {tensor}
        </span>
        <span
          className="text-[10px] font-mono opacity-40 group-hover:opacity-70 transition-opacity"
          style={{ color }}
        >
          View in MOA
        </span>
      </button>

      {/* AGT distribution bar */}
      {hasDistribution && (
        <div className="flex items-center gap-2 max-w-xs">
          {/* Bar */}
          <div className="flex h-2 rounded-full overflow-hidden flex-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            {segments.map((seg) => (
              <div
                key={seg.label}
                style={{
                  width: `${seg.pct}%`,
                  backgroundColor: seg.color,
                  opacity: seg.label === tensor ? 1 : 0.5,
                }}
              />
            ))}
          </div>
          {/* Percentage labels — largest first */}
          <div className="flex items-center gap-1.5 shrink-0">
            {segments.map((seg) => (
              <span
                key={seg.label}
                className="text-[10px] font-mono font-bold"
                style={{ color: seg.color, opacity: seg.label === tensor ? 1 : 0.6 }}
              >
                {seg.pct}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
