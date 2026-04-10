"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";

type AGT_KEY = "COG" | "EMO" | "ENV";

interface Node {
  id: string;
  label: string;
  group: string;
  agt: AGT_KEY;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  href: string;
  description: string;
  subLabels: string[];
  pulse: number;
  emo: number;
  env: number;
  cog: number;
}

interface Edge { source: string; target: string; }

const AGT: Record<string, { color: string; glow: string }> = {
  COG: { color: "#eab308", glow: "rgba(234,179,8,0.35)" },
  EMO: { color: "#f43f5e", glow: "rgba(244,63,94,0.35)" },
  ENV: { color: "#60a5fa", glow: "rgba(96,165,250,0.35)" },
};

const GROUP_LABELS: Record<string, string> = {
  root: "OPTX Docs",
  "getting-started": "Getting Started",
  authentication: "Authentication",
  protocol: "AARON Protocol",
  astrojoe: "JOE — Jett Optics Engine",
  architecture: "Architecture Flows",
  infrastructure: "Infrastructure",
  reference: "API Reference",
  dojo: "Jett Optical Encryption",
};

// JettChat orange primary for accent labels
const JETTCHAT_ORANGE = "rgb(249,115,22)";

const NODES_DATA: Omit<Node, "x" | "y" | "vx" | "vy" | "pulse">[] = [
  { id: "index", label: "OPTX", group: "root", agt: "COG", radius: 34, href: "/docs", description: "Documentation home — full system overview", subLabels: ["Augment Space", "Knowledge Graph", "All Sections"], emo: 10, env: 10, cog: 80 },
  { id: "what-is-optx", label: "What is OPTX?", group: "getting-started", agt: "COG", radius: 19, href: "/docs/getting-started/what-is-optx", description: "Core concepts and naming hierarchy for the OPTX ecosystem", subLabels: ["Naming Hierarchy", "JETT Auth", "AARON", "$OPTX Token"], emo: 25, env: 20, cog: 55 },
  { id: "architecture-overview", label: "Architecture", group: "getting-started", agt: "COG", radius: 17, href: "/docs/getting-started/architecture", description: "End-to-end system architecture from edge to chain", subLabels: ["Jetson Edge", "Tailscale Mesh", "K3s Cluster"], emo: 15, env: 30, cog: 55 },
  { id: "on-chain", label: "On-Chain", group: "getting-started", agt: "ENV", radius: 15, href: "/docs/getting-started/on-chain-addresses", description: "Solana program addresses, token mints, and wallet config", subLabels: ["$OPTX Mint", "$JTX Mint", "DePIN Program", "Helius RPC"], emo: 10, env: 80, cog: 10 },
  { id: "gaze", label: "Gaze Auth", group: "authentication", agt: "EMO", radius: 22, href: "/docs/authentication/gaze", description: "AGT biometric authentication via iris tracking and gaze vectors", subLabels: ["MediaPipe FaceLandmarker", "COG/EMO/ENV Tensors", "Iris 468/473", "Gaze PIN"], emo: 55, env: 5, cog: 40 },
  { id: "wallet", label: "Agent Wallet", group: "authentication", agt: "EMO", radius: 17, href: "/docs/authentication/wallet", description: "ERC-8004 soulbound agent wallet with x402 payment support", subLabels: ["ERC-8004", "x402 Protocol", "Soulbound NFT", "Secure Enclave"], emo: 50, env: 40, cog: 10 },
  { id: "aaron-protocol", label: "AARON", group: "protocol", agt: "COG", radius: 22, href: "/docs/protocol", description: "Asynchronous Audit RAG Optical Node — biometric proof protocol", subLabels: ["Session Flow", "Gaze Verify", "SpacetimeDB Attestation", "Entropy Scoring"], emo: 20, env: 15, cog: 65 },
  { id: "biometric-proof", label: "Bio Proof", group: "protocol", agt: "COG", radius: 15, href: "/docs/protocol/biometric-proof", description: "Gaze-derived cryptographic proofs for on-chain attestation", subLabels: ["Biometric Proofs", "On-Chain Attestation", "Quantum-Resistant", "ZK Proofs"], emo: 30, env: 15, cog: 55 },
  { id: "how-it-works", label: "How It Works", group: "protocol", agt: "COG", radius: 14, href: "/docs/protocol/how-it-works", description: "Step-by-step AARON verification flow from gaze to chain", subLabels: ["4-6 Gaze Points", "500ms Hold", "Entropy Check"], emo: 35, env: 10, cog: 55 },
  { id: "client-integration", label: "Client SDK", group: "protocol", agt: "COG", radius: 13, href: "/docs/protocol/client-integration", description: "Integration guide for connecting apps to AARON", subLabels: ["TypeScript SDK", "REST API", "WebSocket"], emo: 25, env: 30, cog: 45 },
  { id: "aaron-arch", label: "AARON Arch", group: "protocol", agt: "COG", radius: 14, href: "/docs/protocol/architecture", description: "Internal architecture of the AARON router and validator pipeline", subLabels: ["FastAPI Router", "Jetson :8888", "Validator Node"], emo: 15, env: 25, cog: 60 },
  { id: "astrojoe", label: "JOE", group: "astrojoe", agt: "EMO", radius: 24, href: "/docs/astrojoe", description: "Jett Optics Engine — Agent j(OS)H. Primary intelligent agent in the OPTX agentic OS", subLabels: ["Hermes Agent v0.7", "Grok 4.20", "SpacetimeDB", "Matrix Comms", "Task Orchestration"], emo: 45, env: 20, cog: 35 },
  { id: "skills", label: "Skills", group: "astrojoe", agt: "COG", radius: 15, href: "/docs/astrojoe/skills", description: "SKILL.md-based tool system — procedural knowledge for real tool execution", subLabels: ["SKILL.md Format", "Tool Registry", "Execution Engine"], emo: 20, env: 10, cog: 70 },
  { id: "memory", label: "Memory", group: "astrojoe", agt: "COG", radius: 15, href: "/docs/astrojoe/memory", description: "SpacetimeDB-backed persistent memory with importance scoring", subLabels: ["Categories", "Importance Score", "Full-Text Search", "Subscriptions"], emo: 10, env: 25, cog: 65 },
  { id: "orchestration", label: "Orchestration", group: "astrojoe", agt: "COG", radius: 15, href: "/docs/astrojoe/orchestration", description: "Task lifecycle management with DAG workflows and swarm decomposition", subLabels: ["DAG Workflows", "Swarm Agents", "State Machine", "Gaze-Gated"], emo: 15, env: 15, cog: 70 },
  { id: "hedgehog-doc", label: "HEDGEHOG", group: "astrojoe", agt: "ENV", radius: 17, href: "/docs/astrojoe/hedgehog", description: "Multi-API AI gateway — Grok 4.20 primary, Claude fallback", subLabels: ["Grok Gateway", "MCP Server", "12 Tools", "XAI API Stats"], emo: 20, env: 65, cog: 15 },
  { id: "hermes-api", label: "Hermes API", group: "astrojoe", agt: "COG", radius: 14, href: "/docs/astrojoe/api", description: "Enhanced API bridge for Hermes Agent — sessions, skills, memory", subLabels: ["Sessions", "Config", "Task API", "Gateway Proxy"], emo: 10, env: 15, cog: 75 },
  { id: "arch-flows", label: "Flows", group: "architecture", agt: "COG", radius: 17, href: "/docs/architecture", description: "Architecture flow diagrams across the full OPTX stack", subLabels: ["Mermaid Diagrams", "Data Flows", "System Maps"], emo: 15, env: 20, cog: 65 },
  { id: "task-lifecycle", label: "Task Life", group: "architecture", agt: "COG", radius: 12, href: "/docs/architecture/task-lifecycle", description: "Task creation through completion with state transitions", subLabels: ["Create → Claim → Execute", "Completion Proofs"], emo: 15, env: 15, cog: 70 },
  { id: "swarm-dag", label: "Swarm DAG", group: "architecture", agt: "COG", radius: 12, href: "/docs/architecture/swarm-dag", description: "Multi-agent DAG decomposition for parallel task execution", subLabels: ["Parallel/Sequential", "Agent Pools", "Dependency Graph"], emo: 30, env: 15, cog: 55 },
  { id: "gaze-policy", label: "Gaze Policy", group: "architecture", agt: "EMO", radius: 12, href: "/docs/architecture/gaze-policy", description: "Gaze-gated authorization policies for sensitive operations", subLabels: ["Policy Rules", "Threshold Config", "AGT Requirements"], emo: 55, env: 15, cog: 30 },
  { id: "bridge-flow", label: "Bridge Flow", group: "architecture", agt: "EMO", radius: 12, href: "/docs/architecture/bridge-flow", description: "Cross-chain pipeline from XRPL to Solana via LayerZero", subLabels: ["XRPL → Solana", "LayerZero", "USDC Bridge"], emo: 55, env: 35, cog: 10 },
  { id: "agent-identity", label: "Identity", group: "architecture", agt: "EMO", radius: 13, href: "/docs/architecture/agent-identity", description: "On-chain agent identity with Metaplex NFT and ERC-8004", subLabels: ["Metaplex NFT", "DID Resolution", "Owner Authority"], emo: 65, env: 25, cog: 10 },
  { id: "task-states", label: "States", group: "architecture", agt: "COG", radius: 11, href: "/docs/architecture/task-states", description: "Finite state machine for task lifecycle management", subLabels: ["Pending → Active", "Failed/Retry", "Completed"], emo: 10, env: 10, cog: 80 },
  { id: "topology", label: "Topology", group: "architecture", agt: "ENV", radius: 13, href: "/docs/architecture/topology", description: "Network topology across Jetson edge, Tailscale mesh, and cloud", subLabels: ["Jetson Orin", "Tailscale Mesh", "Vercel Edge"], emo: 15, env: 75, cog: 10 },
  { id: "edge-mcp", label: "Edge MCP", group: "infrastructure", agt: "ENV", radius: 17, href: "/docs/infrastructure/edge", description: "HEDGEHOG MCP running on Jetson validator nodes at the edge", subLabels: ["Jetson K3s", "Local Inference", "Gaze Processing"], emo: 20, env: 70, cog: 10 },
  { id: "depin", label: "DePIN", group: "infrastructure", agt: "ENV", radius: 15, href: "/docs/infrastructure/depin", description: "CSTB Trust attestation and DePIN validator staking", subLabels: ["$CSTB Token", "Validator Staking", "Trust Score"], emo: 15, env: 65, cog: 20 },
  { id: "bridge-hub", label: "Bridge Hub", group: "on-chain-bridge", agt: "EMO", radius: 19, href: "/docs/on-chain-bridge", description: "Multi-chain bridge architecture — OPTX to EVM, XRPL, LayerZero", subLabels: ["AARON Router", "Multi-Chain", "Bridge Infra"], emo: 50, env: 40, cog: 10 },
  { id: "solana-native", label: "Solana", group: "on-chain-bridge", agt: "EMO", radius: 15, href: "/docs/on-chain-bridge/solana-native", description: "Home chain — $OPTX, $JTX, $CSTB, DePIN, Metaplex identity", subLabels: ["Token-2022", "$OPTX · $JTX", "Metaplex Core"], emo: 45, env: 45, cog: 10 },
  { id: "evm-layerzero", label: "EVM/LZ", group: "on-chain-bridge", agt: "EMO", radius: 15, href: "/docs/on-chain-bridge/evm-layerzero", description: "Cross-chain $OPTX to ETH, Base, ARB, POLY via LayerZero OFT", subLabels: ["LayerZero OFT", "ERC-20 Wrap", "DVN Verify"], emo: 55, env: 35, cog: 10 },
  { id: "xrpl-wormhole", label: "XRPL/WH", group: "on-chain-bridge", agt: "EMO", radius: 15, href: "/docs/on-chain-bridge/xrpl-wormhole", description: "XRPL pipeline — Wormhole NTT, TraderJoe Swarm, xSPECTAR NFTs", subLabels: ["Wormhole NTT", "TraderJoe Swarm", "xSPECTAR NFTs"], emo: 55, env: 35, cog: 10 },
  { id: "api-ref", label: "API Ref", group: "reference", agt: "COG", radius: 16, href: "/docs/reference/api", description: "Complete API reference — WebSocket RPC and REST endpoints", subLabels: ["WebSocket RPC", "REST Endpoints", "Auth Headers"], emo: 5, env: 5, cog: 90 },
  { id: "doc-index", label: "Index", group: "reference", agt: "COG", radius: 15, href: "/docs/reference", description: "Complete documentation index — every page classified by AGT tensor", subLabels: ["33 Pages", "AGT Classification", "arscontexta Inspired"], emo: 10, env: 10, cog: 80 },
  { id: "dojo", label: "DOJO", group: "dojo", agt: "ENV", radius: 19, href: "/docs/dojo", description: "Developer Operator Jett Optics — IDE training ground and augment marketplace", subLabels: ["Augment Marketplace", "Skill Composition", "Knowledge Graph"], emo: 25, env: 45, cog: 30 },
  { id: "mojo", label: "MOJO", group: "dojo", agt: "EMO", radius: 15, href: "/docs/dojo/mojo", description: "Mobile Jett Optics — wallet identity, biometrics, Jett Cursor & Widgets", subLabels: ["Jett Cursor", "Wallet Connect", "Mobile Biometrics"], emo: 50, env: 35, cog: 15 },
  { id: "moa", label: "MOA", group: "dojo", agt: "COG", radius: 14, href: "/docs/dojo/moa", description: "Map of Augments — cognitive cartography of the documentation graph", subLabels: ["Force Graph", "AGT Classification", "Visual Index"], emo: 30, env: 15, cog: 55 },
];

const EDGES: Edge[] = [
  { source: "index", target: "what-is-optx" }, { source: "index", target: "astrojoe" },
  { source: "index", target: "arch-flows" },
  { source: "index", target: "gaze" }, { source: "index", target: "aaron-protocol" },
  { source: "index", target: "edge-mcp" }, { source: "index", target: "api-ref" },
  { source: "index", target: "dojo" },
  { source: "what-is-optx", target: "architecture-overview" },
  { source: "what-is-optx", target: "on-chain" },
  { source: "architecture-overview", target: "on-chain" },
  { source: "gaze", target: "aaron-protocol" }, { source: "gaze", target: "biometric-proof" },
  { source: "wallet", target: "on-chain" }, { source: "wallet", target: "agent-identity" },
  { source: "aaron-protocol", target: "biometric-proof" },
  { source: "aaron-protocol", target: "how-it-works" },
  { source: "aaron-protocol", target: "client-integration" },
  { source: "aaron-protocol", target: "aaron-arch" },
  { source: "biometric-proof", target: "gaze" },
  { source: "astrojoe", target: "skills" }, { source: "astrojoe", target: "memory" },
  { source: "astrojoe", target: "orchestration" }, { source: "astrojoe", target: "hedgehog-doc" },
  { source: "astrojoe", target: "hermes-api" }, { source: "astrojoe", target: "agent-identity" },
  { source: "skills", target: "dojo" }, { source: "memory", target: "edge-mcp" },
  { source: "orchestration", target: "task-lifecycle" },
  { source: "orchestration", target: "swarm-dag" },
  { source: "hedgehog-doc", target: "edge-mcp" }, { source: "hermes-api", target: "api-ref" },
  { source: "arch-flows", target: "task-lifecycle" },
  { source: "arch-flows", target: "swarm-dag" },
  { source: "arch-flows", target: "gaze-policy" },
  { source: "arch-flows", target: "bridge-flow" },
  { source: "arch-flows", target: "agent-identity" },
  { source: "arch-flows", target: "task-states" },
  { source: "arch-flows", target: "topology" },
  { source: "task-lifecycle", target: "task-states" },
  { source: "gaze-policy", target: "gaze" }, { source: "gaze-policy", target: "aaron-protocol" },
  { source: "bridge-flow", target: "evm-layerzero" }, { source: "agent-identity", target: "on-chain" },
  { source: "edge-mcp", target: "topology" }, { source: "evm-layerzero", target: "bridge-flow" },
  { source: "depin", target: "on-chain" },
  { source: "dojo", target: "skills" }, { source: "dojo", target: "moa" },
  { source: "dojo", target: "mojo" }, { source: "mojo", target: "astrojoe" },
  { source: "mojo", target: "hedgehog-doc" },
  { source: "bridge-hub", target: "solana-native" }, { source: "bridge-hub", target: "evm-layerzero" },
  { source: "bridge-hub", target: "xrpl-wormhole" }, { source: "bridge-hub", target: "aaron-protocol" },
  { source: "bridge-hub", target: "on-chain" }, { source: "solana-native", target: "on-chain" },
  { source: "solana-native", target: "depin" }, { source: "evm-layerzero", target: "bridge-hub" },
  { source: "xrpl-wormhole", target: "bridge-flow" },
  { source: "doc-index", target: "api-ref" }, { source: "doc-index", target: "moa" },
  { source: "mojo", target: "depin" },
  { source: "mojo", target: "aaron-arch" },
  { source: "depin", target: "gaze" },
  { source: "depin", target: "agent-identity" },
  { source: "astrojoe", target: "bridge-hub" },
  { source: "what-is-optx", target: "gaze" },
  { source: "architecture-overview", target: "depin" },
  { source: "aaron-protocol", target: "on-chain" },
  { source: "aaron-arch", target: "on-chain" },
  { source: "biometric-proof", target: "edge-mcp" },
  { source: "how-it-works", target: "gaze" },
  { source: "how-it-works", target: "on-chain" },
  { source: "client-integration", target: "mojo" },
  { source: "client-integration", target: "topology" },
  { source: "aaron-arch", target: "topology" },
  { source: "skills", target: "topology" },
  { source: "orchestration", target: "topology" },
  { source: "hermes-api", target: "on-chain" },
  { source: "task-lifecycle", target: "agent-identity" },
  { source: "task-lifecycle", target: "on-chain" },
  { source: "swarm-dag", target: "astrojoe" },
  { source: "swarm-dag", target: "hedgehog-doc" },
  { source: "gaze-policy", target: "topology" },
  { source: "bridge-flow", target: "on-chain" },
  { source: "task-states", target: "gaze" },
  { source: "task-states", target: "on-chain" },
  { source: "topology", target: "bridge-hub" },
  { source: "edge-mcp", target: "depin" },
  { source: "evm-layerzero", target: "aaron-protocol" },
  { source: "depin", target: "architecture-overview" },
  { source: "solana-native", target: "aaron-protocol" },
  { source: "evm-layerzero", target: "how-it-works" },
  { source: "evm-layerzero", target: "on-chain" },
  { source: "xrpl-wormhole", target: "how-it-works" },
  { source: "xrpl-wormhole", target: "on-chain" },
  { source: "api-ref", target: "wallet" },
  { source: "api-ref", target: "on-chain" },
  { source: "doc-index", target: "wallet" },
  { source: "doc-index", target: "topology" },
  { source: "dojo", target: "edge-mcp" },
  { source: "moa", target: "mojo" },
  { source: "moa", target: "on-chain" },
  { source: "architecture-overview", target: "hedgehog-doc" },
  { source: "wallet", target: "aaron-protocol" },
  { source: "gaze", target: "on-chain" },
  { source: "hedgehog-doc", target: "orchestration" },
];

interface Particle { edge: number; t: number; speed: number; color: string; size: number; }

function initNodes(w: number, h: number): Node[] {
  const cx = w / 2, cy = h / 2;
  return NODES_DATA.map((n, i) => {
    const angle = (i / NODES_DATA.length) * Math.PI * 2;
    const r = 100 + Math.random() * 220;
    return {
      ...n,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      pulse: Math.random() * Math.PI * 2,
      subLabels: n.subLabels || [],
    };
  });
}

function initParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 15; i++) {
    const ei = Math.floor(Math.random() * EDGES.length);
    const agtKey = NODES_DATA[Math.floor(Math.random() * NODES_DATA.length)].agt;
    particles.push({
      edge: ei,
      t: Math.random(),
      speed: 0.001 + Math.random() * 0.002,
      color: AGT[agtKey].color,
      size: 0.8 + Math.random() * 0.8,
    });
  }
  return particles;
}

export function MoaVisual() {
  return (
    <Suspense fallback={<div className="moa-fullscreen" />}>
      <MoaVisualInner />
    </Suspense>
  );
}

function MoaVisualInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const [hovered, setHovered] = useState<Node | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [pinnedCards, setPinnedCards] = useState<{ node: Node; x: number; y: number }[]>([]);
  const [showIndex, setShowIndex] = useState(false);
  const cardDragRef = useRef<{ idx: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState<Node | null>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [dims, setDims] = useState({ w: 900, h: 700 });
  const initialized = useRef(false);

  // Pan + Zoom state
  const panRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const zoomRef = useRef(1);
  const [zoomLevel, setZoomLevel] = useState(1);

  const getConnected = useCallback((nodeId: string) => {
    const ids = new Set<string>();
    EDGES.forEach((e) => {
      if (e.source === nodeId) ids.add(e.target);
      if (e.target === nodeId) ids.add(e.source);
    });
    return ids;
  }, []);

  useEffect(() => {
    const resize = () => {
      const container = containerRef.current;
      const w = container ? container.clientWidth : window.innerWidth;
      const h = container ? container.clientHeight : (window.innerHeight - 56);
      setDims({ w, h });
      if (!initialized.current) {
        nodesRef.current = initNodes(w, h);
        particlesRef.current = initParticles();
        initialized.current = true;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { window.removeEventListener("resize", resize); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const nodes = nodesRef.current;
    const particles = particlesRef.current;
    if (nodes.length === 0) return;

    const cx = dims.w / 2, cy = dims.h / 2;

    function simulate() {
      const pan = panRef.current;
      const centerX = cx - pan.x;
      const centerY = cy - pan.y;
      for (const n of nodes) {
        n.vx += (centerX - n.x) * 0.0005;
        n.vy += (centerY - n.y) * 0.0005;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 900 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      for (const e of EDGES) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 110) * 0.0012;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }
      for (const n of nodes) {
        if (dragging && n.id === dragging.id) continue;
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx * 0.35;
        n.y += n.vy * 0.35;
      }
    }

    function draw() {
      if (!ctx || !canvas) return;
      timeRef.current += 0.016;
      const t = timeRef.current;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = dims.w * dpr;
      canvas.height = dims.h * dpr;
      ctx.scale(dpr, dpr);

      // JettChat is always dark — hsl(0 0% 4%) background
      const pan = panRef.current;

      // Deep space background with warm vignette (matches optx-docs MOA)
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(dims.w, dims.h) * 0.7);
      bgGrad.addColorStop(0, "#0d0908");
      bgGrad.addColorStop(0.3, "#0a0706");
      bgGrad.addColorStop(0.6, "#080505");
      bgGrad.addColorStop(1, "#050303");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, dims.w, dims.h);

      // Subtle warm atmospheric glow (orange/red vignette from center)
      const atmoGrad = ctx.createRadialGradient(cx * 0.8, cy * 0.6, 0, cx, cy, Math.max(dims.w, dims.h) * 0.5);
      atmoGrad.addColorStop(0, "rgba(249,115,22,0.03)");
      atmoGrad.addColorStop(0.4, "rgba(239,68,68,0.015)");
      atmoGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atmoGrad;
      ctx.fillRect(0, 0, dims.w, dims.h);

      // Apply pan + zoom
      const zoom = zoomRef.current;
      ctx.save();
      ctx.translate(dims.w / 2, dims.h / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-dims.w / 2 + pan.x, -dims.h / 2 + pan.y);

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const activeId = selected?.id || hovered?.id;
      const connected = activeId ? getConnected(activeId) : new Set<string>();

      // Edges
      for (const e of EDGES) {
        const s = nodeMap.get(e.source);
        const tp = nodeMap.get(e.target);
        if (!s || !tp) continue;
        const isActive = activeId && (e.source === activeId || e.target === activeId);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tp.x, tp.y);

        if (isActive) {
          const grad = ctx.createLinearGradient(s.x, s.y, tp.x, tp.y);
          grad.addColorStop(0, AGT[s.agt].color + "88");
          grad.addColorStop(1, AGT[tp.agt].color + "88");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -t * 15;
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.035)";
          ctx.lineWidth = 0.5;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Particles
      for (const p of particles) {
        const e = EDGES[p.edge];
        const s = nodeMap.get(e.source);
        const tp = nodeMap.get(e.target);
        if (!s || !tp) continue;
        p.t += p.speed;
        if (p.t > 1) { p.t = 0; p.edge = Math.floor(Math.random() * EDGES.length); }
        const px = s.x + (tp.x - s.x) * p.t;
        const py = s.y + (tp.y - s.y) * p.t;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "44";
        ctx.fill();
      }

      // Nodes
      for (const n of nodes) {
        const agt = AGT[n.agt];
        const isActive = n.id === activeId;
        const isConnected = connected.has(n.id);
        const dimmed = activeId && !isActive && !isConnected;

        const pulse = Math.sin(t * 0.6 + n.pulse) * 0.04 + 1;
        const r = n.radius * (isActive ? 1.04 : pulse * (dimmed ? 0.97 : 1));

        // Glow
        if (!dimmed) {
          const glowR = r + 5 + Math.sin(t * 0.8 + n.pulse) * 1.5;
          const grad = ctx.createRadialGradient(n.x, n.y, r * 0.9, n.x, n.y, glowR);
          grad.addColorStop(0, agt.glow.replace("0.35", isActive ? "0.3" : "0.08"));
          grad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Pulse ring on active
        if (isActive) {
          const ringPhase = (t * 0.4) % 1;
          const ringR = r + ringPhase * 18;
          const ringAlpha = (1 - ringPhase) * 0.15;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = agt.color + Math.round(ringAlpha * 255).toString(16).padStart(2, "0");
          ctx.lineWidth = 1 * (1 - ringPhase);
          ctx.stroke();
        }

        // Node fill
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        if (dimmed) {
          ctx.fillStyle = "rgba(20,20,20,0.3)";
        } else {
          const grad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
          grad.addColorStop(0, agt.color + (isActive ? "ff" : "cc"));
          grad.addColorStop(1, agt.color + (isActive ? "aa" : "66"));
          ctx.fillStyle = grad;
        }
        ctx.fill();

        // Border
        if (!dimmed) {
          ctx.strokeStyle = isActive
            ? "rgba(255,255,255,0.6)"
            : agt.color + "33";
          ctx.lineWidth = isActive ? 1.5 : 0.5;
          ctx.stroke();
        }

        // Label
        if (!dimmed || n.radius > 18) {
          const fontSize = r > 24 ? 11 : r > 17 ? 9 : r > 13 ? 7.5 : 6.5;
          ctx.font = `600 ${fontSize}px ui-monospace, "JetBrains Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          if (dimmed) {
            ctx.fillStyle = "rgba(255,255,255,0.06)";
          } else if (isActive) {
            ctx.fillStyle = "#fff";
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.8)";
          }
          ctx.fillText(n.label, n.x, n.y);
        }
      }

      ctx.restore();
      simulate();
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [dims, hovered, selected, dragging, panning, zoomLevel, getConnected]);

  const findNode = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const pan = panRef.current;
      const zoom = zoomRef.current;
      const cw = rect.width;
      const ch = rect.height;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const x = (sx - cw / 2) / zoom + cw / 2 - pan.x;
      const y = (sy - ch / 2) / zoom + ch / 2 - pan.y;
      for (const n of nodesRef.current) {
        const dx = n.x - x, dy = n.y - y;
        if (dx * dx + dy * dy < (n.radius + 5) * (n.radius + 5)) return n;
      }
      return null;
    },
    []
  );

  const activeNode = selected || hovered;

  return (
    <div ref={containerRef} className="moa-fullscreen">
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        className="block"
        style={{
          width: dims.w,
          height: dims.h,
          cursor: panning ? "grabbing" : (hovered ? "pointer" : "grab"),
        }}
        onMouseMove={(e) => {
          if (panStartRef.current && !dragging) {
            const dx = e.clientX - panStartRef.current.mx;
            const dy = e.clientY - panStartRef.current.my;
            panRef.current = { x: panStartRef.current.px + dx, y: panStartRef.current.py + dy };
            if (!panning && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) setPanning(true);
            return;
          }
          const n = findNode(e);
          setHovered(n);
          if (dragging) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const pan = panRef.current;
              const zoom = zoomRef.current;
              const sx = e.clientX - rect.left;
              const sy = e.clientY - rect.top;
              dragging.x = (sx - rect.width / 2) / zoom + rect.width / 2 - pan.x;
              dragging.y = (sy - rect.height / 2) / zoom + rect.height / 2 - pan.y;
              dragging.vx = 0;
              dragging.vy = 0;
            }
          }
        }}
        onClick={(e) => {
          if (panning) { setPanning(false); return; }
          const n = findNode(e);
          if (!n) { setSelected(null); return; }
          if (n && selected?.id === n.id) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const pan = panRef.current;
              const screenX = n.x + pan.x + (rect?.left || 0);
              const screenY = n.y + pan.y + (rect?.top || 0);
              const alreadyPinned = pinnedCards.some(p => p.node.id === n.id);
              if (!alreadyPinned) {
                setPinnedCards(prev => [...prev, {
                  node: n,
                  x: Math.min(screenX, dims.w - 340),
                  y: Math.max(60, screenY - 180),
                }]);
              }
            }
          } else {
            setSelected(n);
          }
        }}
        onDoubleClick={(e) => {
          const n = findNode(e);
          if (n) {
            // In JettChat context: close overlay and navigate
            window.dispatchEvent(new CustomEvent("augment-space-close"));
            window.open(n.href, "_blank", "noopener");
          }
        }}
        onMouseDown={(e) => {
          const n = findNode(e);
          if (n) {
            setDragging(n);
          } else {
            panStartRef.current = {
              mx: e.clientX,
              my: e.clientY,
              px: panRef.current.x,
              py: panRef.current.y,
            };
          }
        }}
        onMouseUp={() => {
          setDragging(null);
          panStartRef.current = null;
          setPanning(false);
        }}
        onMouseLeave={() => {
          setHovered(null);
          setDragging(null);
          panStartRef.current = null;
          setPanning(false);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.92 : 1.08;
          const newZoom = Math.max(0.3, Math.min(3, zoomRef.current * delta));
          zoomRef.current = newZoom;
          setZoomLevel(newZoom);
        }}
      />

      {/* Hover/Select Info Card (bottom-right) */}
      {activeNode && !pinnedCards.some(p => p.node.id === activeNode.id) && (
        <NodeCard
          node={activeNode}
          getConnected={getConnected}
          nodes={nodesRef.current}
          isSelected={selected?.id === activeNode.id}
          style={{ position: "fixed", bottom: 24, right: 24, pointerEvents: "none" }}
        />
      )}

      {/* Pinned draggable cards */}
      {pinnedCards.map((card, idx) => (
        <div
          key={card.node.id}
          style={{ position: "fixed", left: card.x, top: card.y, zIndex: 60, cursor: "move" }}
          onMouseDown={(e) => {
            e.stopPropagation();
            cardDragRef.current = { idx, ox: e.clientX - card.x, oy: e.clientY - card.y };
            const handleMove = (ev: MouseEvent) => {
              if (!cardDragRef.current) return;
              setPinnedCards(prev => prev.map((c, i) =>
                i === cardDragRef.current!.idx
                  ? { ...c, x: ev.clientX - cardDragRef.current!.ox, y: ev.clientY - cardDragRef.current!.oy }
                  : c
              ));
            };
            const handleUp = () => {
              cardDragRef.current = null;
              window.removeEventListener("mousemove", handleMove);
              window.removeEventListener("mouseup", handleUp);
            };
            window.addEventListener("mousemove", handleMove);
            window.addEventListener("mouseup", handleUp);
          }}
        >
          <NodeCard
            node={card.node}
            getConnected={getConnected}
            nodes={nodesRef.current}
            isSelected={true}
            onClose={() => setPinnedCards(prev => prev.filter((_, i) => i !== idx))}
            onNavigate={() => {
              window.dispatchEvent(new CustomEvent("augment-space-close"));
              window.open(card.node.href, "_blank", "noopener");
            }}
          />
        </div>
      ))}

      {/* Index Panel (toggleable) */}
      {showIndex && (
        <div className="fixed top-16 right-4 w-[320px] max-h-[calc(100vh-6rem)] overflow-y-auto bg-background/95 backdrop-blur-xl border border-border rounded-xl font-mono z-50 shadow-lg shadow-black/20">
          <div className="sticky top-0 px-3.5 py-2.5 border-b border-border bg-background/95 backdrop-blur-xl flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground uppercase tracking-widest font-display">Node Index</span>
            <button onClick={() => setShowIndex(false)} className="text-muted-foreground hover:text-foreground text-[11px]">close</button>
          </div>
          {Object.entries(GROUP_LABELS).filter(([k]) => k !== "root").map(([groupKey, groupName]) => {
            const groupNodes = NODES_DATA.filter(n => n.group === groupKey);
            if (groupNodes.length === 0) return null;
            return (
              <div key={groupKey} className="border-b border-border/30 last:border-b-0">
                <div
                  className="px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-widest font-display"
                  style={{ color: JETTCHAT_ORANGE }}
                >
                  {groupName}
                </div>
                {groupNodes.map(n => (
                  <button
                    key={n.id}
                    className="w-full px-3.5 py-1.5 grid grid-cols-[8px_1fr_auto_auto] items-center gap-2 text-left hover:bg-accent/30 transition-colors"
                    onClick={() => {
                      const live = nodesRef.current.find(ln => ln.id === n.id);
                      if (live) {
                        setSelected(live);
                        panRef.current = { x: dims.w / 2 - live.x, y: dims.h / 2 - live.y };
                      }
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: AGT[n.agt].color,
                        boxShadow: `0 0 4px ${AGT[n.agt].glow}`,
                      }}
                    />
                    <span className="text-[10px] text-foreground truncate">{n.label}</span>
                    <span
                      className="text-[7px] font-bold px-1 py-0.5 rounded"
                      style={{ color: AGT[n.agt].color, backgroundColor: AGT[n.agt].color + "15" }}
                    >
                      {n.agt}
                    </span>
                    <div className="flex items-center gap-1 min-w-[72px] justify-end">
                      <span className="text-[7px] font-bold" style={{ color: "#f43f5e" }}>{n.emo}</span>
                      <span className="text-[7px] text-muted-foreground/30">/</span>
                      <span className="text-[7px] font-bold" style={{ color: "#60a5fa" }}>{n.env}</span>
                      <span className="text-[7px] text-muted-foreground/30">/</span>
                      <span className="text-[7px] font-bold" style={{ color: "#eab308" }}>{n.cog}</span>
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom bar: Legend + Index toggle */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-5 font-mono bg-background/60 backdrop-blur-md rounded-full px-4 py-1.5 border border-border/50 z-50">
        {(["COG", "EMO", "ENV"] as const).map((key) => (
          <span key={key} className="flex items-center gap-1.5 text-[9px]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AGT[key].color }} />
            <span style={{ color: AGT[key].color }} className="font-bold opacity-80">{key}</span>
          </span>
        ))}
        <span className="w-px h-3 bg-border/50" />
        <button
          onClick={() => setShowIndex(v => !v)}
          className="text-[9px] font-bold opacity-70 hover:opacity-100 transition-opacity uppercase tracking-wider"
          style={{ color: JETTCHAT_ORANGE }}
        >
          {showIndex ? "Close" : "Index"}
        </button>
        {pinnedCards.length > 0 && (
          <>
            <span className="w-px h-3 bg-border/50" />
            <button
              onClick={() => setPinnedCards([])}
              className="text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear {pinnedCards.length} card{pinnedCards.length > 1 ? "s" : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* NodeCard Component */
function NodeCard({
  node, getConnected, nodes, isSelected, style, onClose, onNavigate,
}: {
  node: Node;
  getConnected: (id: string) => Set<string>;
  nodes: Node[];
  isSelected: boolean;
  style?: React.CSSProperties;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  const connectedIds = getConnected(node.id);
  const connectedNodes = nodes.filter(n => connectedIds.has(n.id));
  const groupLabel = GROUP_LABELS[node.group] || node.group;

  return (
    <div
      className="w-[320px] bg-background/95 backdrop-blur-xl border border-border rounded-xl overflow-hidden font-mono shadow-lg shadow-black/20"
      style={style}
    >
      {/* Header */}
      <div
        className="px-3.5 py-2.5 border-b border-border/50"
        style={{ background: `linear-gradient(135deg, ${AGT[node.agt].color}11, transparent)` }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: AGT[node.agt].color, boxShadow: `0 0 8px ${AGT[node.agt].glow}` }}
          />
          <span className="font-bold text-foreground text-[13px] tracking-wide">{node.label}</span>
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
            style={{
              backgroundColor: AGT[node.agt].color + "18",
              color: AGT[node.agt].color,
              border: `1px solid ${AGT[node.agt].color}33`,
            }}
          >
            {node.agt}
          </span>
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-muted-foreground hover:text-foreground text-[11px] ml-1"
            >
              x
            </button>
          )}
        </div>
        <span className="text-[9px] text-muted-foreground/70 uppercase tracking-widest font-semibold">{groupLabel}</span>
      </div>

      {/* Description */}
      <div className="px-3.5 py-2.5 border-b border-border/30">
        <p className="text-muted-foreground text-[11px] leading-relaxed">{node.description}</p>
      </div>

      {/* Sub-labels / Key Topics */}
      {node.subLabels.length > 0 && (
        <div className="px-3.5 py-2 border-b border-border/30">
          <span className="text-[8px] text-muted-foreground/50 uppercase tracking-widest font-semibold block mb-1.5">Key Topics</span>
          <div className="flex flex-wrap gap-1.5">
            {node.subLabels.map((tag) => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded-md border"
                style={{
                  color: AGT[node.agt].color,
                  borderColor: AGT[node.agt].color + "25",
                  backgroundColor: AGT[node.agt].color + "08",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Connected */}
      {connectedNodes.length > 0 && (
        <div className="px-3.5 py-2 border-b border-border/30">
          <span className="text-[8px] text-muted-foreground/50 uppercase tracking-widest font-semibold block mb-1.5">
            Connected ({connectedNodes.length})
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {connectedNodes.map((cn) => (
              <span key={cn.id} className="flex items-center gap-1 text-[9px] text-muted-foreground/80">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AGT[cn.agt].color }} />
                {cn.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Path + Actions */}
      <div className="px-3.5 py-2 flex items-center justify-between">
        <span className="text-[8px] text-muted-foreground/40 truncate">{node.href}</span>
        {onNavigate ? (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
            className="text-[9px] font-bold px-3 py-1 rounded-md transition-all duration-150 hover:scale-105 hover:shadow-lg cursor-pointer border"
            style={{
              color: AGT[node.agt].color,
              backgroundColor: AGT[node.agt].color + "15",
              borderColor: AGT[node.agt].color + "33",
            }}
          >
            Open Docs →
          </button>
        ) : (
          <span className="text-[9px]" style={{ color: AGT[node.agt].color + "99" }}>
            {isSelected ? "click again to pin" : "click to select"}
          </span>
        )}
      </div>
    </div>
  );
}
