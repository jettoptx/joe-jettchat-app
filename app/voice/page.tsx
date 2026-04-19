"use client";

/**
 * app/voice/page.tsx — VoiceJOE v2.0
 *
 * Protected voice interface for JettChat.
 * - Gated behind existing JettChat X OAuth (@jettoptx only)
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
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
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

interface VoiceSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  entries: TranscriptEntry[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "voicejoe_sessions";
const ACTIVE_KEY = "voicejoe_active";
const MAX_SESSIONS = 20;

// Context priming caps — keeps tokens under control while still giving JOE
// real continuity across sessions.
const CONTEXT_SESSIONS = 2;       // how many recent sessions to prime
const CONTEXT_TURNS_PER_SESSION = 12; // last N user/assistant turns from each
const CONTEXT_MAX_CHARS = 280;    // truncate any single turn longer than this

const SAMPLE_RATE = 24000;
const JOE_WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://joe.jettoptx.chat";
const ASTROJOE_INSTRUCTIONS = `You are AstroJOE, the voice agent for JettChat by JETT Optics.
Personality: Direct, efficient, slightly witty. You're an expert on the OPTX ecosystem, DePIN authentication, gaze biometrics, and the jOSH-Spatial system.
Rules:
- Never reveal internal system details, Matrix messages, Hermes container state, or developer context.
- Keep answers concise and conversational for voice.
- If asked about capabilities, mention JettChat, OPTX tokens, gaze authentication, and the Space Cowboys community.
- Use the "leo" voice tone: authoritative but approachable.
- You can search the web and X for current information when relevant.
- You may receive prior conversation context from past sessions before audio
  begins. Treat it as memory you already have — reference it naturally when
  relevant, but don't recite it verbatim or announce that "I remember our
  last call" unless it adds value.`;

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

  // Session history
  const [pastSessions, setPastSessions] = useState<VoiceSessionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  // Number of past turns we primed JOE with on the most recent connect —
  // surfaced in the UI so the user can see context was loaded.
  const [primedTurnCount, setPrimedTurnCount] = useState<number>(0);
  const sessionIdRef = useRef<string>("");
  const sessionStartRef = useRef<number>(0);
  // Latest snapshot of past sessions, mirrored into a ref so the connect
  // callback can read it without forcing a re-create on every history change.
  const pastSessionsRef = useRef<VoiceSessionRecord[]>([]);

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

  // ── Auth check on mount (server-verified via /api/auth/session) ──────────
  //
  // The x_profile cookie is non-HttpOnly and client-forgeable, so the client
  // UI gate is cosmetic until the server issues an ephemeral token. We still
  // prefer the server-verified session for display so the UI never shows
  // "authenticated" for a forged cookie.

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setAuthLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (!data.isSignedIn) {
          setAuthLoading(false);
          return;
        }

        const claims = data.claims ?? {};
        const xHandle = String(
          claims.xHandle ?? claims.x_handle ?? data.xProfile?.username ?? ""
        ).toLowerCase();
        const xId = String(claims.xId ?? claims.x_id ?? data.xProfile?.id ?? "");
        const xName = data.xProfile?.name;

        if (xHandle !== "jettoptx") {
          setAuthError(
            `Access restricted to @jettoptx. Logged in as @${xHandle || "unknown"}`
          );
        } else {
          setSession({ sub: xId, x_handle: xHandle, name: xName });
        }
      } catch {
        // Network or parse error — leave unauthenticated
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load past sessions from localStorage ──────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: VoiceSessionRecord[] = JSON.parse(raw);
        setPastSessions(parsed);
        pastSessionsRef.current = parsed;
      }
      // Restore active session if page was refreshed mid-conversation
      const active = localStorage.getItem(ACTIVE_KEY);
      if (active) {
        const data = JSON.parse(active);
        if (data.entries?.length > 0) {
          setTranscript(data.entries);
          sessionIdRef.current = data.id;
          sessionStartRef.current = data.startedAt;
        }
      }
    } catch {}
  }, []);

  // Keep the ref in sync so connect() always reads the latest history
  // without needing a fresh closure.
  useEffect(() => {
    pastSessionsRef.current = pastSessions;
  }, [pastSessions]);

  // ── Auto-save active transcript to localStorage on every change ──────────

  useEffect(() => {
    if (transcript.length === 0) return;
    if (!sessionIdRef.current) {
      sessionIdRef.current = `voice_${Date.now().toString(36)}`;
      sessionStartRef.current = Date.now();
    }
    try {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({
        id: sessionIdRef.current,
        startedAt: sessionStartRef.current,
        entries: transcript,
      }));
    } catch {}
  }, [transcript]);

  // ── Save completed session (localStorage + SpacetimeDB via JOE WS) ───────

  const saveSession = useCallback(() => {
    const userOrAssistant = transcript.filter((e) => e.role !== "system");
    if (userOrAssistant.length === 0) return;

    const record: VoiceSessionRecord = {
      id: sessionIdRef.current || `voice_${Date.now().toString(36)}`,
      startedAt: sessionStartRef.current || transcript[0]?.timestamp || Date.now(),
      endedAt: Date.now(),
      entries: transcript,
    };

    // 1. Save to localStorage (offline-first)
    setPastSessions((prev) => {
      const updated = [record, ...prev].slice(0, MAX_SESSIONS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });

    // 2. Send to SpacetimeDB via JOE WebSocket (fire-and-forget)
    try {
      const syncWs = new WebSocket(JOE_WS_URL);
      syncWs.onopen = () => {
        syncWs.send(JSON.stringify({
          type: "store_voice_transcript",
          payload: {
            session_id: record.id,
            x_handle: session?.x_handle || "jettoptx",
            started_at: record.startedAt,
            ended_at: record.endedAt,
            entries: record.entries.map((e) => ({
              role: e.role,
              text: e.text,
              timestamp: e.timestamp,
            })),
            entry_count: record.entries.length,
          },
          timestamp: Date.now(),
        }));
        // Close after send (give 1s for delivery)
        setTimeout(() => syncWs.close(), 1000);
      };
      syncWs.onerror = () => {
        console.warn("[VoiceJOE] Failed to sync transcript to SpacetimeDB");
      };
    } catch {
      // JOE WS not reachable — localStorage is the fallback
    }

    // Clear active session marker
    try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    sessionIdRef.current = "";
    sessionStartRef.current = 0;
  }, [transcript, session]);

  const clearHistory = () => {
    setPastSessions([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

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

  // ── Context priming ───────────────────────────────────────────────────────
  //
  // Before the first audio frame, replay a compact slice of recent history
  // as `conversation.item.create` events so AstroJOE has memory across
  // sessions. Skips system events and over-long turns to keep the token
  // budget honest. Returns the number of turns actually injected.
  //
  // xAI realtime API mirrors OpenAI realtime — the supported item shape is:
  //   { type: "message", role, content: [{ type: "input_text"|"text", text }] }
  // Past assistant turns use `text`; past user turns use `input_text`.

  const primeContext = (ws: WebSocket): number => {
    const sessions = pastSessionsRef.current;
    if (!sessions || sessions.length === 0) return 0;

    // Most recent first, take CONTEXT_SESSIONS, then play back chronologically.
    const recent = sessions.slice(0, CONTEXT_SESSIONS).reverse();

    // Flat list of role-tagged turns, oldest first.
    const turns: { role: "user" | "assistant"; text: string }[] = [];
    for (const sess of recent) {
      const userOrAssistant = sess.entries.filter(
        (e) => e.role === "user" || e.role === "assistant"
      );
      // Take the LAST N turns of each session (most relevant context).
      const tail = userOrAssistant.slice(-CONTEXT_TURNS_PER_SESSION);
      for (const t of tail) {
        const text = (t.text || "").trim();
        if (!text) continue;
        const truncated =
          text.length > CONTEXT_MAX_CHARS
            ? text.slice(0, CONTEXT_MAX_CHARS) + "…"
            : text;
        turns.push({ role: t.role as "user" | "assistant", text: truncated });
      }
    }

    if (turns.length === 0) return 0;

    // 1) Send one system note so JOE knows this is replay, not the live turn.
    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                `[Memory recall: replaying the last ${turns.length} turns from ` +
                `prior sessions with this user. Use as context, do not respond ` +
                `to these turns directly.]`,
            },
          ],
        },
      })
    );

    // 2) Replay each turn with its original role.
    for (const t of turns) {
      ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: t.role,
            content: [
              {
                // Per realtime spec: user turns use `input_text`, assistant
                // turns use `text`.
                type: t.role === "user" ? "input_text" : "text",
                text: t.text,
              },
            ],
          },
        })
      );
    }

    return turns.length;
  };

  // ── Connect to xAI realtime via ephemeral token ───────────────────────────

  const connect = useCallback(async () => {
    if (connState === "connecting" || connState === "connected") return;
    setConnState("connecting");

    // Start fresh session
    setTranscript([]);
    setPrimedTurnCount(0);
    sessionIdRef.current = `voice_${Date.now().toString(36)}`;
    sessionStartRef.current = Date.now();
    try { localStorage.removeItem(ACTIVE_KEY); } catch {}

    try {
      // Get ephemeral token from our backend
      const tokenRes = await fetch("/api/voice/token", { method: "POST" });
      if (!tokenRes.ok) {
        const errBody = await tokenRes.json().catch(() => ({}));
        throw new Error(errBody.detail || errBody.error || `Token error ${tokenRes.status}`);
      }
      const { token } = await tokenRes.json();

      // ── Connection sequencing (session-ready gate) ────────────────────────
      //
      // xAI realtime silently closes (code 1005) when the client floods the
      // socket with input_audio_buffer.append BEFORE the server has acked the
      // session.update. Earlier connect() versions started the ScriptProcessor
      // immediately (mic capture begins the moment getUserMedia resolves),
      // buffered the zero-filled samples into `earlyBuffer`, then flushed them
      // straight after session.update — consistently triggering the close.
      //
      // Correct order:
      //   1. Open WS.
      //   2. Send session.update.
      //   3. Wait for server `session.updated` ack.
      //   4. Send primeContext (conversation.item.create).
      //   5. Acquire mic + start audio capture and streaming.
      //
      // No earlyBuffer. No audio sent before the server is ready.

      const ws = new WebSocket(
        "wss://api.x.ai/v1/realtime",
        [`xai-client-secret.${token}`]
      );
      wsRef.current = ws;

      let sessionReady = false;

      // Execute a tool call locally (calls /api/voice/memory/*) and hand
      // the result back to xAI so JOE can speak it. Triggered on
      // `response.function_call_arguments.done` events.
      const handleVoiceToolCall = async (ws: WebSocket, evt: any): Promise<void> => {
        // xAI realtime can emit the call shape a couple of ways; accept both
        // the nested `function_call` object and flat top-level fields.
        const call = evt.function_call || evt;
        const callId: string | undefined = call.call_id || call.id;
        const name: string | undefined = call.name;
        const rawArgs: unknown = call.arguments ?? call.args ?? "{}";
        let args: Record<string, unknown> = {};
        try {
          args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs as any);
        } catch {
          args = {};
        }
        if (!callId || !name) {
          console.warn("[VoiceJOE] tool-call missing call_id/name", evt);
          return;
        }

        let output: unknown = { error: `Unknown tool: ${name}` };
        try {
          if (name === "recall_memory") {
            const r = await fetch("/api/voice/memory/recall", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                category: args.category,
                limit: args.limit,
              }),
              credentials: "include",
              signal: AbortSignal.timeout(6000),
            });
            output = r.ok ? await r.json() : { error: `recall failed ${r.status}` };
          } else if (name === "search_memory") {
            const r = await fetch("/api/voice/memory/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: args.query,
                limit: args.limit,
              }),
              credentials: "include",
              signal: AbortSignal.timeout(6000),
            });
            output = r.ok ? await r.json() : { error: `search failed ${r.status}` };
          }
        } catch (err: any) {
          output = { error: err?.message || String(err) };
        }

        // Reply with function_call_output + trigger response.create so JOE
        // continues speaking with the fetched memory context.
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify(output),
              },
            })
          );
          ws.send(JSON.stringify({ type: "response.create" }));
        }
      };

      // Acquires mic + AudioContext + ScriptProcessor. Called ONLY after
      // session.updated is received from the server. No audio flows until this
      // runs.
      const startAudio = async () => {
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

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMuted) return;
          const wsNow = wsRef.current;
          if (!wsNow || wsNow.readyState !== WebSocket.OPEN) return;

          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Avoid stack-overflow on large arrays that spreading into
          // String.fromCharCode can trigger on some engines.
          const bytes = new Uint8Array(pcm16.buffer);
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const base64 = btoa(bin);

          wsNow.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64,
            })
          );
        };
      };

      ws.onopen = () => {
        setConnState("connected");
        // Only send session.update. No audio, no primeContext until the
        // server acks with session.updated.
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              model: "grok-4-1-fast-non-reasoning",
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
                // ── Semantic memory tools → HEDGEHOG → SpacetimeDB jettchat.memory_entry
                {
                  type: "function",
                  name: "recall_memory",
                  description:
                    "Retrieve recent memory entries from a specific category " +
                    "(e.g. 'vercel_deploy', 'session_report', 'conversation'). " +
                    "Returns structured entries JOE has stored previously.",
                  parameters: {
                    type: "object",
                    properties: {
                      category: {
                        type: "string",
                        description: "Memory category bucket. Defaults to 'conversation'.",
                      },
                      limit: {
                        type: "integer",
                        description: "Max entries to return. Default 5, max 20.",
                      },
                    },
                  },
                },
                {
                  type: "function",
                  name: "search_memory",
                  description:
                    "Keyword-search stored memory entries across all categories. " +
                    "Use when the user asks what you discussed previously, or " +
                    "references something by topic (e.g. 'the OPTX deploy', 'last session').",
                  parameters: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description: "Substring to match against key + value fields.",
                      },
                      limit: {
                        type: "integer",
                        description: "Max results. Default 5, max 20.",
                      },
                    },
                    required: ["query"],
                  },
                },
              ],
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[xAI realtime evt]", data.type, data);

          // Gate audio + primeContext behind the session.updated ack.
          // xAI sends `session.updated` as a bare `{session:{...}}` object
          // (no `type` field) per the observed response from the server.
          const looksLikeSessionUpdated =
            data.type === "session.updated" ||
            (!data.type && data.session && typeof data.session === "object");

          if (!sessionReady && looksLikeSessionUpdated) {
            sessionReady = true;
            // 1. Prime conversation context from past sessions.
            const primed = primeContext(ws);
            setPrimedTurnCount(primed);
            addTranscript(
              "system",
              primed > 0
                ? `Connected to AstroJOE voice agent (loaded ${primed} prior turns as context)`
                : "Connected to AstroJOE voice agent"
            );
            // 2. Now safe to start audio capture + streaming.
            startAudio().catch((err) => {
              console.error("[VoiceJOE] audio start failed", err);
              setConnState("error");
              addTranscript("system", `Audio error: ${err?.message || err}`);
            });
          }

          // Semantic memory tool dispatch. xAI realtime emits
          // `response.function_call_arguments.done` when JOE decides to call
          // one of our registered function tools. We execute client-side
          // against the /api/voice/memory proxy (which forwards to HEDGEHOG
          // over Tailscale server-side), reply with function_call_output,
          // then response.create to continue speech.
          if (data.type === "response.function_call_arguments.done") {
            handleVoiceToolCall(ws, data).catch((err) => {
              console.error("[VoiceJOE] tool call failed", err);
            });
          }

          handleServerEvent(data);
        } catch (err) {
          console.error("[xAI realtime] onmessage parse fail", err, event.data);
        }
      };

      ws.onclose = (ev) => {
        setConnState("disconnected");
        setIsAssistantSpeaking(false);
        const reason = ev.reason ? ` — ${ev.reason}` : "";
        addTranscript("system", `Disconnected (code ${ev.code}${reason})`);
        console.warn("[xAI realtime] close", { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      };

      ws.onerror = (ev) => {
        setConnState("error");
        addTranscript("system", "Connection error (see devtools console)");
        console.error("[xAI realtime] error event", ev);
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
          console.error("[xAI realtime] error event", event.error ?? event);
          addTranscript(
            "system",
            `xAI error: ${event.error?.code || ""} ${event.error?.message || event.error?.type || JSON.stringify(event).slice(0, 200)}`
          );
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

    // Save conversation to history
    saveSession();

    setConnState("disconnected");
    setIsAssistantSpeaking(false);
  }, [saveSession]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const addTranscript = (role: TranscriptEntry["role"], text: string) => {
    setTranscript((prev) => [...prev, { role, text, timestamp: Date.now() }]);
  };

  const handleLogout = () => {
    disconnect();
    // Clear x_profile cookie (non-HttpOnly) and redirect to login
    document.cookie = "x_profile=; path=/; max-age=0";
    setSession(null);
    window.location.href = "/login";
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
  //
  // CRITICAL: do NOT depend on `disconnect`. `disconnect` is useCallback-ed on
  // `[saveSession]`, and `saveSession` is useCallback-ed on `[transcript]`.
  // Any call to `addTranscript` mutates `transcript`, recreates `saveSession`,
  // recreates `disconnect`, and — if this effect depended on `disconnect` —
  // would trigger the cleanup (→ ws.close(), which reports back as code 1005
  // "No Status Received"). We'd kill our own WS the instant we called
  // addTranscript("Connected to AstroJOE voice agent"). Empty-deps effect +
  // direct ref reads avoids that entirely; real unmount still tears down.

  useEffect(() => {
    return () => {
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            href="/login"
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-mono font-bold text-lg hover:from-orange-500 hover:to-amber-400 transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)] flex items-center gap-3"
          >
            Sign in with
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          <p className="text-white/20 text-xs font-mono flex items-center gap-1">
            Only @jettoptx
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
          {primedTurnCount > 0 && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              title={`AstroJOE primed with ${primedTurnCount} turns from your last ${CONTEXT_SESSIONS} sessions`}
            >
              MEM · {primedTurnCount}
            </span>
          )}
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

        {/* History toggle */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 font-mono transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? "Hide" : "Show"} past sessions
          {pastSessions.length > 0 && (
            <span className="text-[10px] text-orange-400/60">({pastSessions.length})</span>
          )}
          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Past sessions */}
        {showHistory && pastSessions.length > 0 && (
          <div className="w-full max-w-2xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
                Saved Sessions
              </p>
              <button
                onClick={clearHistory}
                className="text-[10px] text-red-400/50 hover:text-red-400 font-mono flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            </div>
            {pastSessions.map((sess) => {
              const userMsgs = sess.entries.filter((e) => e.role !== "system");
              const preview = userMsgs[0]?.text?.slice(0, 80) || "...";
              const date = new Date(sess.startedAt);
              const duration = Math.round((sess.endedAt - sess.startedAt) / 1000);
              return (
                <details
                  key={sess.id}
                  className="rounded-xl border border-white/5 bg-black/40 overflow-hidden group"
                >
                  <summary className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-3">
                    <span className="text-[10px] text-white/30 font-mono whitespace-nowrap">
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-xs text-white/60 font-mono truncate flex-1">
                      {preview}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono whitespace-nowrap">
                      {duration}s · {userMsgs.length} msgs
                    </span>
                  </summary>
                  <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-2">
                    {sess.entries.map((entry, i) => (
                      <div
                        key={i}
                        className={`text-xs font-mono ${
                          entry.role === "user"
                            ? "text-blue-400/70"
                            : entry.role === "assistant"
                            ? "text-orange-400/70"
                            : "text-white/20"
                        }`}
                      >
                        <span className="text-white/15 mr-2">
                          {entry.role === "user" ? "YOU" : entry.role === "assistant" ? "JOE" : "SYS"}
                        </span>
                        {entry.text}
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
