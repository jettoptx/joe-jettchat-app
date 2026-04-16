"use client";

/**
 * app/gensys/page.tsx — GENSYS: Jett Keypad + Trust Protocol Mint
 *
 * Layout:
 *   - Top nav: logo, DEVNET badge, wallet connect
 *   - Center hero: Jett Keypad (Venn diagram, interactive numbers)
 *   - Right sidebar (fixed 420px): AstroJOE chat + protocol status
 *   - 3-step flow: Sign in with X → Enter 6-digit Key → Mint $OPTX
 *
 * JETT Optics
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import Image from "next/image";
import {
  Send,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Wallet,
  Eye,
  Zap,
  Coins,
  Mic,
} from "lucide-react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { JettKeypad, DEFAULT_PLACEMENT } from "@/components/ui/JettKeypad";

// ── Types ────────────────────────────────────────────────────────────────────

type Region =
  | "yellow"
  | "blue"
  | "red"
  | "yellowBlue"
  | "blueRed"
  | "redYellow"
  | "center";

type FlowStep = "connect" | "keypad" | "mint";

// ── Main Page ────────────────────────────────────────────────────────────────

export default function GensysPage() {
  // Wallet
  const { publicKey, connected } = useWallet();

  // Chat
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([
    {
      role: "assistant",
      content:
        "Howdy, I'm GENSYS JOE. Connect your wallet and complete the Trust Protocol to mint $OPTX.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Jett Keypad
  const [placedNumbers, setPlacedNumbers] = useState<Record<Region, number[]>>(
    DEFAULT_PLACEMENT as Record<Region, number[]>
  );
  const [gazeActive, setGazeActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Protocol
  const [protocolInit, setProtocolInit] = useState<boolean | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("connect");
  const [mintLoading, setMintLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────

  const centerCount = placedNumbers.center?.length || 0;
  const keypadComplete = centerCount >= 6;

  useEffect(() => {
    if (!connected) setFlowStep("connect");
    else if (!keypadComplete) setFlowStep("keypad");
    else setFlowStep("mint");
  }, [connected, keypadComplete]);

  // ── Protocol check ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function checkProtocol() {
      try {
        const { PublicKey } = await import("@solana/web3.js");
        const programId = new PublicKey(
          "79nQsecDspUWxvAMyJvK36EUty4yEoP5ssLvHZuNiugF"
        );
        const [configPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("protocol-config")],
          programId
        );

        const res = await fetch(
          process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
            "https://api.devnet.solana.com",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getAccountInfo",
              params: [configPDA.toBase58()],
            }),
          }
        );
        const data = await res.json();
        setProtocolInit(data.result?.value !== null);
      } catch {
        setProtocolInit(false);
      }
    }
    checkProtocol();
  }, []);

  // ── TTS ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window !== "undefined") synthRef.current = window.speechSynthesis;
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!ttsEnabled || !synthRef.current) return;
      synthRef.current.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 0.9;
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      u.onerror = () => setIsSpeaking(false);
      synthRef.current.speak(u);
    },
    [ttsEnabled]
  );

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "wss://joe.jettoptx.chat";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const content = data.text || data.content || event.data;
        setMessages((prev) => [...prev, { role: "assistant", content }]);
        speakText(content);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: event.data },
        ]);
      }
    };
    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
  }, [speakText]);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({ type: "chat", content: input, timestamp: Date.now() })
    );
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
  };

  // ── Keypad handler ─────────────────────────────────────────────────────────

  const handleNumberTap = (num: number, fromRegion: Region) => {
    setPlacedNumbers((prev) => ({
      ...prev,
      center: [...(prev.center || []), num],
      [fromRegion]: (prev[fromRegion] || []).filter((n) => n !== num),
    }));
  };

  // ── Gaze session ───────────────────────────────────────────────────────────

  const startGaze = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setGazeActive(true);

      // Simulate AARON gaze session
      setTimeout(async () => {
        try {
          await fetch("http://100.85.183.16:8888/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id: "gensys_" + Date.now().toString(36),
              action: "gaze_verify",
            }),
          });
        } catch {
          // AARON not reachable — simulated
        }

        // Auto-place a number as gaze result
        const availableRegions = Object.entries(placedNumbers).filter(
          ([r, nums]) => r !== "center" && nums.length > 0
        );
        if (availableRegions.length > 0) {
          const [region, nums] = availableRegions[0];
          handleNumberTap(nums[0], region as Region);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `Gaze captured. AGT: COG[0.92] EMO[0.87] ENV[0.94]`,
          },
        ]);
        setGazeActive(false);
      }, 1500);
    } catch {
      alert("Camera access required for gaze tracking");
      setGazeActive(false);
    }
  };

  // ── Mint (placeholder until protocol initialized) ──────────────────────────

  const handleMint = async () => {
    if (!connected || !publicKey) return;
    setMintLoading(true);

    try {
      // Check protocol first
      if (!protocolInit) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content:
              "Protocol not initialized on devnet. Run: npx ts-node scripts/init-protocol-devnet.ts",
          },
        ]);
        setMintLoading(false);
        return;
      }

      // TODO: Full Trust Protocol flow via useOPTXProtocol hook
      // For now, show the flow
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `Initiating Trust Handshake for ${publicKey.toBase58().slice(0, 8)}...`,
        },
      ]);

      // Simulated for now
      await new Promise((r) => setTimeout(r, 2000));
      setTxSig("simulated_" + Date.now().toString(36));

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Keypad sequence signed. Your gaze + compute entropy will mint $OPTX once the protocol is initialized on devnet.",
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `Error: ${err.message}` },
      ]);
    } finally {
      setMintLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* ─── Top Nav ───────────────────────────────────────────────────── */}
      <nav className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="font-mono text-sm tracking-wide">GENSYS — JOE</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30">
            DEVNET
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={startGaze}
            disabled={gazeActive}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              gazeActive
                ? "bg-red-500/20 text-red-400 animate-pulse"
                : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
            }`}
          >
            {gazeActive ? "● GAZING" : "START GAZE"}
          </button>
          <Link
            href="/voice"
            className="p-2 rounded-lg transition-colors text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
            title="VoiceJOE"
          >
            <Mic className="w-4 h-4" />
          </Link>
          <button
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (synthRef.current) synthRef.current.cancel();
              setIsSpeaking(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              ttsEnabled
                ? "text-orange-400 bg-orange-500/10"
                : "text-white/30 bg-white/5"
            }`}
          >
            {ttsEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Wallet button */}
          <div className="[&_button]:!bg-orange-600 [&_button]:!rounded-lg [&_button]:!h-9 [&_button]:!text-sm [&_button]:!font-mono">
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* ─── Main Layout: grid with 2 columns ─────────────────────────── */}
      <div
        className="flex-1 overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: "1fr 380px" }}
      >
        {/* ─── Left: Jett Keypad centered ──────────────────────────────── */}
        <div className="flex flex-col items-center justify-center overflow-y-auto p-4">
          <video ref={videoRef} autoPlay playsInline className="hidden" />

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-4">
            <StepPill
              num={1}
              label="Connect"
              icon={<Wallet className="w-3.5 h-3.5" />}
              active={flowStep === "connect"}
              done={connected}
            />
            <div className="w-8 h-px bg-white/10" />
            <StepPill
              num={2}
              label="Sign Key"
              icon={<Eye className="w-3.5 h-3.5" />}
              active={flowStep === "keypad"}
              done={keypadComplete}
            />
            <div className="w-8 h-px bg-white/10" />
            <StepPill
              num={3}
              label="Mint"
              icon={<Coins className="w-3.5 h-3.5" />}
              active={flowStep === "mint"}
              done={!!txSig}
            />
          </div>

          {/* Protocol warning */}
          {protocolInit === false && (
            <div className="mb-3 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Protocol not initialized</span>
            </div>
          )}

          {/* ── JETT KEYPAD ── */}
          <div style={{ width: 420, maxWidth: "90vw" }}>
            <JettKeypad
              placedNumbers={placedNumbers}
              onNumberTap={handleNumberTap}
              gazeActive={gazeActive}
              size="lg"
            />
          </div>

          {/* Action area */}
          <div className="mt-4 flex items-center justify-center">
            {flowStep === "connect" && !connected && (
              <div className="text-center">
                <p className="text-white/40 text-sm font-mono mb-3">
                  Connect your Phantom wallet to begin
                </p>
                <div className="[&_button]:!bg-orange-600 [&_button]:!rounded-xl [&_button]:!h-12 [&_button]:!px-8 [&_button]:!text-base [&_button]:!font-mono">
                  <WalletMultiButton />
                </div>
              </div>
            )}

            {flowStep === "keypad" && (
              <p className="text-white/50 text-xs font-mono tracking-[3px] uppercase">
                Tap numbers or gaze to sign • {centerCount}/6 placed
              </p>
            )}

            {flowStep === "mint" && (
              <div className="text-center">
                <button
                  onClick={handleMint}
                  disabled={mintLoading}
                  className="px-10 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-mono font-bold text-lg hover:from-orange-500 hover:to-amber-400 transition-all disabled:opacity-50 flex items-center gap-3 shadow-[0_0_30px_rgba(249,115,22,0.3)]"
                >
                  {mintLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  Mint $OPTX
                </button>
                {txSig && (
                  <a
                    href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-400/70 hover:text-orange-400 font-mono mt-2 inline-block"
                  >
                    {txSig.slice(0, 16)}... ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Sidebar: Chat + Status ──────────────────────────────── */}
        <aside className="border-l border-white/5 bg-black/60 flex flex-col overflow-hidden">
          {/* Status panel */}
          <div className="p-3 border-b border-white/5">
            <div className="grid grid-cols-3 gap-2">
              <StatusPill label="Program" value="79nQse...iugF" />
              <StatusPill
                label="Protocol"
                value={
                  protocolInit === null
                    ? "..."
                    : protocolInit
                    ? "Active"
                    : "Not Init"
                }
                color={protocolInit ? "green" : "amber"}
              />
              <StatusPill
                label="Wallet"
                value={
                  connected
                    ? publicKey!.toBase58().slice(0, 6) + "..."
                    : "—"
                }
                color={connected ? "green" : "white"}
              />
            </div>
          </div>

          {/* Chat messages */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-3"
            style={{ scrollbarWidth: "thin" }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-orange-600 text-white"
                      : msg.role === "system"
                      ? "bg-white/5 text-orange-300/80 font-mono text-xs border border-orange-500/10"
                      : "bg-zinc-800/80 text-white/90"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Talk to JOE..."
              className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/30"
            />
            <button
              onClick={sendMessage}
              className="bg-orange-600 hover:bg-orange-500 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Step Pill ─────────────────────────────────────────────────────────────────

function StepPill({
  num,
  label,
  icon,
  active,
  done,
}: {
  num: number;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
        done
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : active
          ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
          : "bg-white/5 text-white/30 border border-white/5"
      }`}
    >
      {done ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        icon
      )}
      <span>{label}</span>
    </div>
  );
}

// ── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({
  label,
  value,
  color = "white",
}: {
  label: string;
  value: string;
  color?: "white" | "green" | "amber" | "red";
}) {
  const colorMap = {
    white: "text-white/70",
    green: "text-green-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
      <div className="text-[9px] text-white/40 font-mono uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-xs font-mono truncate ${colorMap[color]}`}>
        {value}
      </div>
    </div>
  );
}
