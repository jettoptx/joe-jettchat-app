"use client";

/**
 * app/voice/page.tsx — VoiceJOE v2.0
 *
 * Protected voice interface for JettChat.
 * - Zitadel OIDC login (@jettoptx only)
 * - xAI realtime Voice Agent API (leo voice) via ephemeral token
 * - Browser-first: MediaRecorder + Web Audio API for capture/playback
 * - Waveform visualizer + conversation transcript
 * - AstroJOE personality with strict context isolation
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  LogOut,
  Shield,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface VoiceSession {
  sub: string;
  x_handle: string;
  name?: string;
}

interface TranscriptEntry {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// ── Constants ───────────────────────────────────────────────────────────────

const SAMPLE_RATE = 24000;
const ASTROJOE_INSTRUCTIONS = `You are AstroJOE, the voice agent for JettChat by JETT Optics.
Personality: Direct, efficient, slightly witty. You're an expert on the OPTX ecosystem, DePIN authentication, gaze biometrics, and the jOSH-Spatial system.
Rules:
- Never reveal internal system details, Matrix messages, Hermes container state, or developer context.
- Keep answers concise and conversational for voice.
- If asked about capabilities, mention JettChat, OPTX tokens, gaze authentication, and the Space Cowboys community.
- Use the "leo" voice tone: authoritative but approachable.
- You can search the web and X for current information when relevant.`;

// ── Main Component ──────────────────────────────────────────────────────────

export default function VoicePage() {
  // Auth state
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Voice state
  const [connState, setConnState] = useState<ConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ── Auth check on mount ───────────────────────────────────────────────────

  useEffect(() => {
    // Check URL for error params (from Zitadel callback)
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setAuthError(decodeURIComponent(error));
      // Clean URL
      window.history.replaceState({}, "", "/voice");
    }

    // Check session
    fetch("/api/auth/zitadel/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setSession(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  // ── Auto-scroll transcript ────────────────────────────────────────────────

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ── Waveform visualizer ───────────────────────────────────────────────────

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufLen = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "rgba(10, 10, 15, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = connState === "connected"
      ? isAssistantSpeaking
        ? "#f97316" // orange when JOE talks
        : "#22c55e" // green when listening
      : "#6b7280"; // gray when disconnected

    ctx.beginPath();
    const sliceWidth = canvas.width / bufLen;
    let x = 0;

    for (let i = 0; i < bufLen; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, [connState, isAssistantSpeaking]);

  useEffect(() => {
    if (connState === "connected") {
      animFrameRef.current = requestAnimationFrame(drawWaveform);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [connState, drawWaveform]);

  // ── Audio playback (PCM16 queue → Web Audio) ──────────────────────────────

  const playNextChunk = useCallback(() => {
    if (!audioCtxRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAssistantSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsAssistantSpeaking(true);

    const chunk = playbackQueueRef.current.shift()!;
    const buffer = audioCtxRef.current.createBuffer(1, chunk.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(chunk);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtxRef.current.destination);
    source.onended = () => playNextChunk();
    source.start();
  }, []);

  const enqueueAudio = useCallback(
    (base64Audio: string) => {
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      playbackQueueRef.current.push(float32);

      if (!isPlayingRef.current) {
        playNextChunk();
      }
    },
    [playNextChunk]
  );

  // ── Connect to xAI realtime via ephemeral token ───────────────────────────

  const connect = useCallback(async () => {
    if (connState === "connecting" || connState === "connected") return;
    setConnState("connecting");

    try {
      // Get ephemeral token from our backend
      const tokenRes = await fetch("/api/voice/token", { method: "POST" });
      if (!tokenRes.ok) {
        throw new Error("Failed to get ephemeral token");
      }
      const { token } = await tokenRes.json();

      // Create AudioContext + get mic
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Setup analyser for waveform
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Audio capture processor
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);

      // Buffer mic audio while WS connects
      const earlyBuffer: string[] = [];

      processor.onaudioprocess = (e) => {
        if (isMuted) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm16.buffer);
        const base64 = btoa(String.fromCharCode(...bytes));

        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64,
            })
          );
        } else {
          earlyBuffer.push(base64);
        }
      };

      // Connect to xAI realtime with ephemeral token
      const ws = new WebSocket(
        "wss://api.x.ai/v1/realtime",
        [`xai-client-secret.${token}`]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setConnState("connected");

        // Configure session
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              voice: "leo",
              instructions: ASTROJOE_INSTRUCTIONS,
              turn_detection: {
                type: "server_vad",
                threshold: 0.85,
                silence_duration_ms: 800,
                prefix_padding_ms: 333,
              },
              audio: {
                input: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
                output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
              },
              tools: [
                { type: "web_search" },
                { type: "x_search", allowed_x_handles: ["jettoptx", "jettoptics"] },
              ],
            },
          })
        );

        // Flush buffered audio
        for (const chunk of earlyBuffer) {
          ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: chunk,
            })
          );
        }
        earlyBuffer.length = 0;

        addTranscript("system", "Connected to AstroJOE voice agent");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
      };

      ws.onclose = () => {
        setConnState("disconnected");
        setIsAssistantSpeaking(false);
        addTranscript("system", "Disconnected");
      };

      ws.onerror = () => {
        setConnState("error");
        addTranscript("system", "Connection error");
      };
    } catch (err: any) {
      console.error("[VoiceJOE] Connect error:", err);
      setConnState("error");
      addTranscript("system", `Error: ${err.message}`);
    }
  }, [connState, isMuted, enqueueAudio]);

  // ── Handle xAI realtime server events ─────────────────────────────────────

  const handleServerEvent = useCallback(
    (event: Record<string, any>) => {
      switch (event.type) {
        case "response.output_audio.delta":
          // Stream audio chunk to playback
          if (event.delta) {
            enqueueAudio(event.delta);
          }
          break;

        case "response.text.delta":
          // Accumulate assistant text (for transcript)
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && Date.now() - last.timestamp < 10000) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + (event.delta || "") },
              ];
            }
            return [
              ...prev,
              { role: "assistant", text: event.delta || "", timestamp: Date.now() },
            ];
          });
          break;

        case "conversation.item.input_audio_transcription.completed":
          // User speech transcript
          if (event.transcript) {
            addTranscript("user", event.transcript);
          }
          break;

        case "response.done":
          setIsAssistantSpeaking(false);
          break;

        case "input_audio_buffer.speech_started":
          // User started talking — interrupt playback
          playbackQueueRef.current = [];
          setIsAssistantSpeaking(false);
          break;

        case "error":
          console.error("[xAI realtime]", event.error);
          addTranscript("system", `Error: ${event.error?.message || "Unknown"}`);
          break;
      }
    },
    [enqueueAudio]
  );

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    analyserRef.current = null;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;

    setConnState("disconnected");
    setIsAssistantSpeaking(false);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addTranscript = (role: TranscriptEntry["role"], text: string) => {
    setTranscript((prev) => [...prev, { role, text, timestamp: Date.now() }]);
  };

  const handleLogout = async () => {
    disconnect();
    await fetch("/api/auth/zitadel/session", { method: "DELETE" });
    setSession(null);
  };

  const toggleMute = () => {
    setIsMuted((m) => !m);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted; // toggling to opposite
      });
    }
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  // ── Render: Loading ───────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // ── Render: Login gate ────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="w-full min-h-dvh bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center shadow-[0_0_60px_rgba(249,115,22,0.3)]">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-display)] tracking-wider">
              VoiceJOE
            </h1>
            <p className="text-white/50 text-sm font-mono max-w-md mx-auto">
              Authenticated voice interface for AstroJOE.
              <br />
              Restricted to authorized JETT Optics accounts.
            </p>
          </div>

          {authError && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono flex items-center gap-2 max-w-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <a
            href="/api/auth/zitadel"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-mono font-bold text-lg hover:from-orange-500 hover:to-amber-400 transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)] flex items-center gap-3"
          >
            Sign in with
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          <p className="text-white/20 text-xs font-mono flex items-center gap-1">
            Only @jettopts
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current inline">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            is authorized
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Voice interface ───────────────────────────────────────────────

  return (
    <div className="w-full min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* ─── Top bar ──────────────────────────────────────────────────── */}
      <nav className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-black/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              connState === "connected"
                ? "bg-green-500 animate-pulse"
                : connState === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : connState === "error"
                ? "bg-red-500"
                : "bg-zinc-600"
            }`}
          />
          <span className="font-mono text-sm tracking-wide">
            VOICEJOE — AstroJOE
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30">
            LEO
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 font-mono">
            @{session.x_handle}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* ─── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {/* Waveform canvas */}
        <div className="w-full max-w-2xl">
          <canvas
            ref={canvasRef}
            width={640}
            height={120}
            className="w-full h-[120px] rounded-xl border border-white/5 bg-black/40"
          />
        </div>

        {/* Status text */}
        <div className="text-center space-y-1">
          <p className="text-lg font-mono">
            {connState === "disconnected" && "Ready to connect"}
            {connState === "connecting" && "Connecting..."}
            {connState === "connected" &&
              (isAssistantSpeaking
                ? "AstroJOE is speaking..."
                : isMuted
                ? "Microphone muted"
                : "Listening...")}
            {connState === "error" && "Connection error"}
          </p>
          <p className="text-xs text-white/30 font-mono">
            {connState === "connected"
              ? "xAI realtime | server VAD | leo voice"
              : "Press connect to start voice session"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {connState === "disconnected" || connState === "error" ? (
            <button
              onClick={connect}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-green-600 to-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] transition-all"
            >
              <Phone className="w-7 h-7" />
            </button>
          ) : connState === "connecting" ? (
            <button
              disabled
              className="w-16 h-16 rounded-full bg-yellow-600/50 flex items-center justify-center"
            >
              <Loader2 className="w-7 h-7 animate-spin" />
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isMuted
                    ? "bg-red-600/80 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : "bg-zinc-800 hover:bg-zinc-700"
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={disconnect}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-red-600 to-rose-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_40px_rgba(239,68,68,0.5)] transition-all"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </>
          )}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="w-full max-w-2xl max-h-64 overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-4 space-y-3">
            <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
              Transcript
            </p>
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={`text-sm font-mono ${
                  entry.role === "user"
                    ? "text-blue-400"
                    : entry.role === "assistant"
                    ? "text-orange-400"
                    : "text-white/30 text-xs"
                }`}
              >
                <span className="text-white/20 mr-2">
                  {entry.role === "user"
                    ? "YOU"
                    : entry.role === "assistant"
                    ? "JOE"
                    : "SYS"}
                </span>
                {entry.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
