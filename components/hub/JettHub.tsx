"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Users,
  Eye,
  Settings,
  Target,
  Globe,
  Shield,
  BarChart3,
  BookOpen,
  Wallet,
  MessageCircle,
  LucideIcon,
} from "lucide-react";
import Image from "next/image";

interface NavigationConnection {
  id: string;
  x: number;
  y: number;
  tensor: string;
  label: string;
  icon: LucideIcon;
  route?: string;
}

interface NavigationState {
  id: string;
  label: string;
  icon: LucideIcon;
  tensor: string;
  parentPos?: { x: number; y: number };
  connections: NavigationConnection[];
}

export function JettHub() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState("jett-hub");
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [animationState, setAnimationState] = useState<
    "idle" | "panning" | "growing"
  >("idle");
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [growthProgress, setGrowthProgress] = useState(0);
  const [hoveredTensor, setHoveredTensor] = useState<
    "emo" | "cog" | "env" | null
  >(null);

  // Aspect ratio for AGT divider line correction
  const [aspectRatio, setAspectRatio] = useState(1);
  useEffect(() => {
    const update = () =>
      setAspectRatio(window.innerWidth / window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Divider line endpoints — true 120deg visual Mercedes pattern
  const agtLineEndpoints = (() => {
    const r = aspectRatio;
    const sqrt3 = Math.sqrt(3);

    if (r < sqrt3) {
      const yHit = 50 - (50 * r) / sqrt3;
      return {
        down: { x2: 50, y2: 100 },
        topLeft: { x2: 0, y2: yHit },
        topRight: { x2: 100, y2: yHit },
      };
    } else {
      const xOffset = (50 * sqrt3) / r;
      return {
        down: { x2: 50, y2: 100 },
        topLeft: { x2: 50 - xOffset, y2: 0 },
        topRight: { x2: 50 + xOffset, y2: 0 },
      };
    }
  })();

  const tensorColors = {
    hub: "#f97316",
    emo: "#ef4444",
    cog: "#facc15",
    env: "#3b82f6",
  };

  const navigationStates: Record<string, NavigationState> = {
    "jett-hub": {
      id: "jett-hub",
      label: "Jett Hub",
      icon: Eye,
      tensor: "hub",
      connections: [
        {
          id: "gaze-optics",
          x: 50,
          y: 20,
          tensor: "cog",
          label: "Gaze Optics",
          icon: Eye,
        },
        {
          id: "connections",
          x: 25,
          y: 75,
          tensor: "emo",
          label: "Connections",
          icon: Users,
        },
        {
          id: "account",
          x: 75,
          y: 75,
          tensor: "env",
          label: "Account",
          icon: Settings,
        },
      ],
    },
    "gaze-optics": {
      id: "gaze-optics",
      label: "Gaze Optics",
      icon: Eye,
      tensor: "cog",
      parentPos: { x: 50, y: 80 },
      connections: [
        {
          id: "dojo-training",
          x: 50,
          y: 20,
          tensor: "cog",
          label: "DOJO Training",
          icon: Target,
          route: "/training",
        },
        {
          id: "augments",
          x: 25,
          y: 75,
          tensor: "emo",
          label: "Augments",
          icon: BookOpen,
          route: "/augments",
        },
        {
          id: "analytics",
          x: 75,
          y: 75,
          tensor: "env",
          label: "Analytics",
          icon: BarChart3,
          route: "/analytics",
        },
      ],
    },
    connections: {
      id: "connections",
      label: "Connections",
      icon: Users,
      tensor: "emo",
      parentPos: { x: 75, y: 25 },
      connections: [
        {
          id: "jettchat",
          x: 50,
          y: 20,
          tensor: "cog",
          label: "JettChat",
          icon: Globe,
          route: "/chat",
        },
        {
          id: "wallets",
          x: 25,
          y: 75,
          tensor: "emo",
          label: "Wallets",
          icon: Wallet,
          route: "/wallets",
        },
        {
          id: "sessions",
          x: 75,
          y: 75,
          tensor: "env",
          label: "Sessions",
          icon: MessageCircle,
          route: "/sessions",
        },
      ],
    },
    account: {
      id: "account",
      label: "Account",
      icon: Settings,
      tensor: "env",
      parentPos: { x: 25, y: 25 },
      connections: [
        {
          id: "security",
          x: 50,
          y: 20,
          tensor: "cog",
          label: "Security",
          icon: Shield,
          route: "/settings",
        },
        {
          id: "profile",
          x: 25,
          y: 75,
          tensor: "emo",
          label: "Profile",
          icon: Users,
          route: "/settings",
        },
        {
          id: "agents",
          x: 75,
          y: 75,
          tensor: "env",
          label: "My Agents",
          icon: Eye,
          route: "/agents",
        },
      ],
    },
  };

  const handleNavigation = (targetId: string, route?: string) => {
    if (animationState !== "idle") return;

    if (route) {
      router.push(route);
      return;
    }

    if (targetId === currentView) return;

    const currentState = navigationStates[currentView];
    let targetPos: { x: number; y: number } | undefined;

    if (targetId === "jett-hub") {
      targetPos = currentState.parentPos;
    } else {
      const conn = currentState.connections.find((c) => c.id === targetId);
      if (!conn) return;
      targetPos = { x: conn.x, y: conn.y };
    }

    if (!targetPos) return;

    const offset = { x: 50 - targetPos.x, y: 50 - targetPos.y };
    setAnimationState("panning");
    setPanOffset(offset);

    setTimeout(() => {
      setCurrentView(targetId);
      setPanOffset({ x: 0, y: 0 });
      setAnimationState("growing");
      setGrowthProgress(0);

      const interval = setInterval(() => {
        setGrowthProgress((prev) => {
          if (prev >= 1) {
            clearInterval(interval);
            setAnimationState("idle");
            return 1;
          }
          return prev + 0.02;
        });
      }, 12);
    }, 600);
  };

  const currentState = navigationStates[currentView];
  if (!currentState) return null;

  const Icon = currentState.icon;
  const currentColor =
    tensorColors[currentState.tensor as keyof typeof tensorColors];

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white overflow-hidden">
      <style>{`
        @keyframes dashPulse { 0%, 100% { stroke-opacity: 0.4; } 50% { stroke-opacity: 1; } }
        .pulse-line { animation: dashPulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* Background radial glow */}
      <div
        className="absolute inset-0 opacity-10 transition-all duration-1000"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, ${currentColor}40 0%, transparent 50%)`,
        }}
      />

      {/* JOE Home button */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 z-40 bg-transparent border-none cursor-pointer group"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-orange-500 rounded-full opacity-20 blur-[40px] group-hover:opacity-40 transition-opacity" />
          <div className="relative w-14 h-14 rounded-full border-2 border-orange-500 overflow-hidden transition-transform group-hover:scale-110 bg-white">
            <Image
              src="/JOE_founder_icon.png"
              alt="JOE"
              width={56}
              height={56}
              className="w-full h-full object-contain p-1"
            />
          </div>
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-orange-500 whitespace-nowrap font-mono">
            JOE
          </span>
        </div>
      </button>

      {/* Main Navigation Area */}
      <div className="relative h-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${panOffset.x}%, ${panOffset.y}%)`,
            transition:
              animationState === "panning"
                ? "transform 500ms ease-out"
                : "none",
          }}
        >
          {/* SVG Lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="0.6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Three AGT section dividers */}
            <g>
              {[
                {
                  x2:
                    animationState === "growing"
                      ? 50 +
                        (agtLineEndpoints.down.x2 - 50) * growthProgress
                      : agtLineEndpoints.down.x2,
                  y2:
                    animationState === "growing"
                      ? 50 +
                        (agtLineEndpoints.down.y2 - 50) * growthProgress
                      : agtLineEndpoints.down.y2,
                },
                {
                  x2:
                    animationState === "growing"
                      ? 50 +
                        (agtLineEndpoints.topLeft.x2 - 50) * growthProgress
                      : agtLineEndpoints.topLeft.x2,
                  y2:
                    animationState === "growing"
                      ? 50 +
                        (agtLineEndpoints.topLeft.y2 - 50) * growthProgress
                      : agtLineEndpoints.topLeft.y2,
                },
                {
                  x2:
                    animationState === "growing"
                      ? 50 +
                        (agtLineEndpoints.topRight.x2 - 50) * growthProgress
                      : agtLineEndpoints.topRight.x2,
                  y2:
                    animationState === "growing"
                      ? 50 +
                        (agtLineEndpoints.topRight.y2 - 50) * growthProgress
                      : agtLineEndpoints.topRight.y2,
                },
              ].map((line, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={line.x2}
                  y2={line.y2}
                  stroke="#f97316"
                  strokeWidth="0.5"
                  strokeDasharray="2 3"
                  className={
                    animationState !== "growing" ? "pulse-line" : undefined
                  }
                  opacity={
                    animationState === "growing"
                      ? growthProgress * 0.7
                      : undefined
                  }
                />
              ))}
            </g>

            {/* Connection lines */}
            {animationState === "idle" &&
              currentState.connections.map((conn) => {
                const isHovered = hoveredPath === conn.id;
                const color =
                  tensorColors[conn.tensor as keyof typeof tensorColors];
                return (
                  <g key={conn.id}>
                    <line
                      x1="50"
                      y1="50"
                      x2={conn.x}
                      y2={conn.y}
                      stroke={color}
                      strokeWidth="0.2"
                      opacity={isHovered ? 0 : 0.15}
                    />
                    {isHovered && (
                      <>
                        <line
                          x1="50"
                          y1="50"
                          x2={conn.x}
                          y2={conn.y}
                          stroke={color}
                          strokeWidth="0.3"
                          opacity="0.6"
                        />
                        <circle
                          r="1"
                          fill={color}
                          opacity="1"
                          filter="url(#glow)"
                        >
                          <animateMotion
                            dur="1s"
                            repeatCount="indefinite"
                            path={`M 50,50 L ${conn.x},${conn.y}`}
                          />
                        </circle>
                      </>
                    )}
                  </g>
                );
              })}

            {/* Parent line */}
            {animationState === "idle" &&
              currentView !== "jett-hub" &&
              currentState.parentPos && (
                <line
                  x1="50"
                  y1="50"
                  x2={currentState.parentPos.x}
                  y2={currentState.parentPos.y}
                  stroke={tensorColors.hub}
                  strokeWidth="0.2"
                  opacity="0.3"
                />
              )}

            {/* Growing lines */}
            {animationState === "growing" &&
              currentState.connections.map((conn) => {
                const color =
                  tensorColors[conn.tensor as keyof typeof tensorColors];
                const progress = Math.min(growthProgress / 0.8, 1);
                return (
                  <g key={conn.id}>
                    <line
                      x1="50"
                      y1="50"
                      x2={50 + (conn.x - 50) * progress}
                      y2={50 + (conn.y - 50) * progress}
                      stroke={color}
                      strokeWidth="0.5"
                      opacity={progress * 0.7}
                      filter="url(#glow)"
                    />
                    {progress > 0.1 && (
                      <circle
                        cx={50 + (conn.x - 50) * progress}
                        cy={50 + (conn.y - 50) * progress}
                        r="0.5"
                        fill={color}
                        opacity={progress}
                        filter="url(#glow)"
                      />
                    )}
                  </g>
                );
              })}

            {/* Growing parent line */}
            {animationState === "growing" &&
              currentView !== "jett-hub" &&
              currentState.parentPos &&
              (() => {
                const progress = Math.min(growthProgress / 0.8, 1);
                return (
                  <line
                    x1="50"
                    y1="50"
                    x2={
                      50 + (currentState.parentPos.x - 50) * progress
                    }
                    y2={
                      50 + (currentState.parentPos.y - 50) * progress
                    }
                    stroke={tensorColors.hub}
                    strokeWidth="0.4"
                    opacity={progress * 0.5}
                    filter="url(#glow)"
                  />
                );
              })()}
          </svg>

          {/* Center Node */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  backgroundColor: currentColor,
                  opacity: 0.2,
                  transform: "scale(1.5)",
                }}
              />
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center bg-black/80"
                style={{
                  boxShadow: `0 0 40px ${currentColor}50`,
                  border: `3px solid ${currentColor}`,
                }}
              >
                {currentView === "jett-hub" ? (
                  <Image
                    src="/astroknotsLOGO.png"
                    alt="JETT Hub"
                    width={96}
                    height={96}
                    className="rounded-full w-full h-full object-contain p-2"
                  />
                ) : (
                  <Icon size={40} style={{ color: currentColor }} />
                )}
              </div>
              <div
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-lg font-semibold whitespace-nowrap z-[35] font-heading"
                style={{ color: currentColor }}
              >
                {currentState.label}
              </div>
            </div>
          </div>

          {/* Connection Nodes */}
          {(animationState === "idle" || animationState === "growing") &&
            currentState.connections.map((conn) => {
              const ConnIcon = conn.icon;
              const isHovered =
                hoveredPath === conn.id && animationState === "idle";
              const color =
                tensorColors[conn.tensor as keyof typeof tensorColors];
              const opacity =
                animationState === "growing"
                  ? Math.max(0, (growthProgress - 0.8) * 5)
                  : 1;
              const scale =
                animationState === "growing"
                  ? 0.5 + Math.max(0, (growthProgress - 0.8) * 2.5)
                  : 1;

              return (
                <div
                  key={conn.id}
                  className="absolute z-10"
                  style={{
                    left: `${conn.x}%`,
                    top: `${conn.y}%`,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    opacity,
                    pointerEvents:
                      animationState === "idle" ? "auto" : "none",
                  }}
                  onMouseEnter={() =>
                    animationState === "idle" && setHoveredPath(conn.id)
                  }
                  onMouseLeave={() => setHoveredPath(null)}
                >
                  <button
                    onClick={() => handleNavigation(conn.id, conn.route)}
                    disabled={animationState !== "idle"}
                    className="bg-transparent border-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div
                      className="transition-all duration-300"
                      style={{
                        transform: isHovered ? "scale(1.1)" : "scale(1)",
                        opacity: isHovered ? 1 : 0.6,
                      }}
                    >
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: isHovered
                            ? "rgba(0,0,0,0.8)"
                            : "rgba(0,0,0,0.4)",
                          border: `2px solid ${isHovered ? color : "rgba(255,255,255,0.1)"}`,
                          boxShadow: isHovered
                            ? `0 0 20px ${color}50`
                            : "none",
                        }}
                      >
                        <ConnIcon
                          size={32}
                          style={{
                            color: isHovered ? color : "#6b7280",
                          }}
                        />
                      </div>
                      <span
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm whitespace-nowrap transition-all duration-200 font-mono"
                        style={{
                          fontWeight: isHovered ? 600 : 400,
                          opacity: isHovered ? 1 : 0.5,
                          color: isHovered ? color : "#d1d5db",
                          textShadow: isHovered
                            ? `0 0 8px ${color}40`
                            : "none",
                        }}
                      >
                        {conn.label}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}

          {/* Parent Node (back to hub) */}
          {(animationState === "idle" || animationState === "growing") &&
            currentView !== "jett-hub" &&
            currentState.parentPos && (
              <div
                className="absolute z-10"
                style={{
                  left: `${currentState.parentPos.x}%`,
                  top: `${currentState.parentPos.y}%`,
                  transform: "translate(-50%, -50%)",
                  opacity:
                    animationState === "growing"
                      ? Math.max(0, (growthProgress - 0.8) * 5)
                      : 1,
                  pointerEvents:
                    animationState === "idle" ? "auto" : "none",
                }}
                onMouseEnter={() =>
                  animationState === "idle" && setHoveredPath("parent")
                }
                onMouseLeave={() => setHoveredPath(null)}
              >
                <button
                  onClick={() => handleNavigation("jett-hub")}
                  disabled={animationState !== "idle"}
                  className="bg-transparent border-none cursor-pointer disabled:cursor-not-allowed"
                >
                  <div
                    className="transition-all duration-300"
                    style={{
                      transform:
                        hoveredPath === "parent"
                          ? "scale(1.1)"
                          : "scale(1)",
                      opacity: hoveredPath === "parent" ? 1 : 0.6,
                    }}
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor:
                          hoveredPath === "parent"
                            ? "rgba(0,0,0,0.8)"
                            : "rgba(0,0,0,0.4)",
                        border: `2px solid ${hoveredPath === "parent" ? tensorColors.hub : "rgba(255,255,255,0.1)"}`,
                        boxShadow:
                          hoveredPath === "parent"
                            ? `0 0 20px ${tensorColors.hub}50`
                            : "none",
                      }}
                    >
                      <Eye
                        size={32}
                        style={{
                          color:
                            hoveredPath === "parent"
                              ? tensorColors.hub
                              : "#6b7280",
                        }}
                      />
                    </div>
                    <span
                      className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm whitespace-nowrap transition-all duration-200 font-mono"
                      style={{
                        fontWeight: hoveredPath === "parent" ? 600 : 400,
                        opacity: hoveredPath === "parent" ? 1 : 0.5,
                        color:
                          hoveredPath === "parent"
                            ? tensorColors.hub
                            : "#d1d5db",
                      }}
                    >
                      Jett Hub
                    </span>
                  </div>
                </button>
              </div>
            )}
        </div>
      </div>

      {/* AGT Tensor Squares */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-6 items-center">
        {(
          [
            {
              key: "emo" as const,
              color: "#ef4444",
              emoji: "\u2764\uFE0F",
              label: "EMO",
            },
            {
              key: "cog" as const,
              color: "#facc15",
              emoji: "\uD83E\uDDE0",
              label: "COG",
            },
            {
              key: "env" as const,
              color: "#3b82f6",
              emoji: "\uD83C\uDF0D",
              label: "ENV",
            },
          ] as const
        ).map((t) => (
          <div
            key={t.key}
            className="relative w-[50px] h-[50px] rounded flex items-center justify-center cursor-pointer transition-all duration-300"
            style={{
              backgroundColor: `${t.color}15`,
              border: `2px solid ${t.color}80`,
              fontSize: hoveredTensor === t.key ? "10px" : "24px",
              fontWeight: hoveredTensor === t.key ? "bold" : "normal",
              color: t.color,
            }}
            onMouseEnter={() => setHoveredTensor(t.key)}
            onMouseLeave={() => setHoveredTensor(null)}
          >
            <div className="absolute -inset-2.5 bg-gradient-to-br from-gray-900 via-slate-900 to-black rounded -z-10" />
            {hoveredTensor === t.key ? t.label : t.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}
