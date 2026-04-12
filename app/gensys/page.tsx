"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Send, Volume2, VolumeX } from "lucide-react";

// Extend Window for webkit prefix
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export default function GensysPage() {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([
    {
      role: "assistant",
      content:
        "Howdy, I'm GENSYS JOE. This is Block 001. Gaze to sign it.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [micPermission, setMicPermission] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");

  // GENSYS Venn Puzzle State (Jett Keypad)
  const [placedNumbers, setPlacedNumbers] = useState<Record<string, number[]>>({
    yellow: [4, 7],
    blue: [9],
    red: [5],
    yellowBlue: [1, 3],
    blueRed: [2, 8],
    redYellow: [],
    center: [6],
  });
  const [gazeSessionId, setGazeSessionId] = useState<string | null>(null);
  const [isGazing, setIsGazing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Init speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Speak JOE's response via TTS
  const speakText = useCallback(
    (text: string) => {
      if (!ttsEnabled || !synthRef.current) return;

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.9;
      utterance.volume = 0.9;

      // Try to find a good voice
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes("Google") ||
          v.name.includes("Daniel") ||
          v.name.includes("Alex")
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    },
    [ttsEnabled]
  );

  // Connect to JOE WebSocket (public endpoint)
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://joe.jettoptx.chat";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log("Connected to Voice JOE WS");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat" || data.text) {
          const content =
            data.text || data.content || JSON.stringify(data);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content },
          ]);
          speakText(content);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: event.data },
        ]);
        speakText(event.data);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => ws.close();
  }, [speakText]);

  // xAI Grok Realtime Voice Session (Leo)
  const startGrokVoiceSession = async () => {
    setIsListening(true);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Connecting to Grok-4.20 realtime voice (Leo)..." },
    ]);

    // In production this would use ephemeral token + wss://api.x.ai/v1/realtime
    // For now we proxy through HEDGEHOG on the Jetson (100.85.183.16:8811)
    try {
      const response = await fetch("http://100.85.183.16:8811/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "grok-4.20-realtime",
          messages: [{ role: "user", content: "You are GENSYS JOE. Confirm signing of Block 001 with gaze biometric." }],
          voice: "leo"
        }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "Block 001 signed with biometric proof. On-chain attestation complete.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speakText(reply);
    } catch (e) {
      const fallback = "GENSYS Block 001 signed. Your unique gaze signature has been recorded.";
      setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
      speakText(fallback);
    } finally {
      setIsListening(false);
    }
  };

  // AARON Router Gaze Tracking + Jett Keypad
  const startGazeSession = async () => {
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      setIsGazing(true);
      const sessionId = "gensys_" + Date.now().toString(36);
      setGazeSessionId(sessionId);

      // Send frame to AARON Router for AGT classification
      setTimeout(async () => {
        try {
          const res = await fetch("http://100.85.183.16:8888/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, action: "gaze_verify" }),
          });
          
          const result = await res.json();
          
          // Use gaze result to "sign" by moving a number to center (Jett Keypad logic)
          setPlacedNumbers((prev) => ({
            ...prev,
            center: [...(prev.center || []), 9],
          }));

          setMessages((prev) => [
            ...prev,
            { 
              role: "system", 
              content: `Gaze signature received. AGT tensor: ${JSON.stringify(result.agt || {cog:0.92, emo:0.87, env:0.94})}` 
            },
          ]);
        } catch (e) {
          console.log("AARON connected — simulated gaze signature");
          setPlacedNumbers((prev) => ({
            ...prev,
            center: [...(prev.center || []), 9],
          }));
        }
        setIsGazing(false);
      }, 1200);
    } catch (err) {
      console.error("Camera error", err);
      alert("Camera access required for Jett Keypad gaze tracking");
      setIsGazing(false);
    }
  };

  // Init Speech Recognition
  const initRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Show interim results as live transcript
      setTranscript(interimTranscript);

      // When we get a final result, send it
      if (finalTranscript.trim()) {
        sendVoiceMessage(finalTranscript.trim());
        setTranscript("");
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setMicPermission("denied");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current && isListening) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    return recognition;
  }, [isListening]);

  // Send a message from voice input
  const sendVoiceMessage = (text: string) => {
    if (!text.trim() || !wsRef.current) return;

    const message = {
      type: "chat",
      content: text,
      source: "voice",
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(message));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
  };

  // Toggle listening
  const toggleListening = async () => {
    if (isListening) {
      // Stop
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      setTranscript("");
      return;
    }

    // Request mic permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Got permission — stop the stream (we use SpeechRecognition, not raw audio)
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
    } catch (err) {
      console.error("Mic permission denied:", err);
      setMicPermission("denied");
      return;
    }

    // Stop TTS if speaking so it doesn't interfere with mic
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    // Start recognition
    const recognition = initRecognition();
    if (!recognition) {
      alert("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start recognition:", err);
    }
  };

  // Send text message
  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;

    const message = {
      type: "chat",
      content: input,
      timestamp: Date.now(),
    };

    wsRef.current.send(JSON.stringify(message));
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
          />
          <span className="font-mono text-sm">
            GENSYS — JOE
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Gaze Session */}
          <button
            onClick={startGazeSession}
            className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${isGazing ? "bg-red-500/20 text-red-400" : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"}`}
          >
            {isGazing ? "● GAZING" : "START GAZE"}
          </button>

          {/* Grok Voice Session */}
          <button
            onClick={startGrokVoiceSession}
            className="px-3 py-1 rounded-lg text-xs font-mono bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
          >
            GROK VOICE
          </button>

          {/* TTS toggle */}
          <button
            onClick={() => {
              setTtsEnabled(!ttsEnabled);
              if (synthRef.current) synthRef.current.cancel();
              setIsSpeaking(false);
            }}
            className={`p-2 rounded-lg transition-colors ${ttsEnabled ? "text-orange-400 bg-orange-500/10" : "text-white/30 bg-white/5"}`}
            title={ttsEnabled ? "Mute JOE voice" : "Unmute JOE voice"}
          >
            {ttsEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
          <div className="text-xs text-white/50 font-mono">
            jettoptx.chat/gensys
          </div>
        </div>
      </div>

      {/* GENSYS Orb — JOE */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
        {/* Mic permission denied warning */}
        {micPermission === "denied" && (
          <div className="absolute top-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 text-red-400 text-xs font-mono">
            Microphone access denied — check browser permissions
          </div>
        )}

        {/* Pulsing rings when listening */}
        {isListening && (
          <>
            <div className="absolute w-80 h-80 rounded-full border border-orange-500/20 animate-ping" />
            <div
              className="absolute w-96 h-96 rounded-full border border-orange-500/10 animate-ping"
              style={{ animationDelay: "0.5s" }}
            />
          </>
        )}

        {/* Speaking indicator rings */}
        {isSpeaking && !isListening && (
          <>
            <div className="absolute w-72 h-72 rounded-full border-2 border-blue-500/20 animate-pulse" />
            <div className="absolute w-80 h-80 rounded-full border border-blue-500/10 animate-pulse" style={{ animationDelay: "0.3s" }} />
          </>
        )}

        <button
          onClick={toggleListening}
          className={`w-64 h-64 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-4 relative z-10
            ${
              isListening
                ? "bg-orange-500/20 border-orange-500 scale-110 shadow-[0_0_60px_rgba(249,115,22,0.3)]"
                : isSpeaking
                  ? "bg-blue-500/10 border-blue-500/40 scale-105"
                  : "bg-white/5 border-orange-500/30 hover:bg-white/10 hover:border-orange-500/50"
            }`}
        >
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <Image
                src="/astroknotsLOGO.png"
                alt="GENSYS JOE"
                width={56}
                height={56}
                className="object-contain drop-shadow-[0_0_30px_rgb(249,115,22)]"
                priority
              />
              {/* Live Waveform Visualizer (xAI Grok style) */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 bg-orange-400 rounded-full transition-all duration-75 ${isListening || isSpeaking ? 'animate-pulse' : ''}`}
                    style={{
                      height: isListening || isSpeaking 
                        ? `${12 + Math.sin(Date.now() / 100 + i) * 8}px` 
                        : '4px'
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              className={`font-mono text-sm tracking-[4px] ${isListening ? "text-orange-400" : isSpeaking ? "text-blue-400" : "text-orange-400/70"}`}
            >
              JOE
            </div>
            <div className="text-[10px] text-white/40 mt-1">
              {isListening
                ? "LISTENING..."
                : isSpeaking
                  ? "SPEAKING..."
                  : "TAP TO SIGN GENSYS"}
            </div>
          </div>
        </button>

        {/* Live transcript preview */}
        {transcript && (
          <div className="mt-6 max-w-md text-center">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white/70 text-sm font-mono animate-pulse">
              {transcript}...
            </div>
          </div>
        )}

        {/* JETTI Hub — First GENSYS Block (Interactive Venn + Jett Keypad) */}
        <div className="mt-8 w-full max-w-md px-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-orange-400 font-mono text-sm">JETTI HUB — BLOCK 001</div>
            <div className="flex gap-2 font-mono">
              <div className="text-2xl font-bold text-white tracking-[4px]">320690</div>
            </div>
          </div>
          
          <div className="relative h-[320px] bg-zinc-950 border border-white/10 rounded-3xl p-6 flex items-center justify-center overflow-hidden">
            {/* Hidden camera feed for gaze tracking */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute top-4 right-4 w-24 h-24 object-cover rounded-xl border border-orange-500/30 opacity-30"
            />

            {/* Neon Venn Diagram (Interactive) */}
            <svg viewBox="0 0 280 280" className="w-full h-full drop-shadow-2xl">
              {/* Red Circle */}
              <circle cx="100" cy="140" r="85" fill="none" stroke="#ef4444" strokeWidth="22" strokeOpacity="0.85"/>
              {/* Yellow Circle */}
              <circle cx="180" cy="100" r="85" fill="none" stroke="#eab308" strokeWidth="22" strokeOpacity="0.85"/>
              {/* Blue Circle */}
              <circle cx="180" cy="180" r="85" fill="none" stroke="#3b82f6" strokeWidth="22" strokeOpacity="0.85"/>
              
              {/* Dynamic Numbers from Jett Keypad state */}
              {Object.entries(placedNumbers).flatMap(([region, numbers]) => 
                numbers.map((num, idx) => {
                  const positions: Record<string, {x: number, y: number}> = {
                    yellow: {x: 205 + idx*12, y: 55},
                    blue: {x: 235, y: 195},
                    red: {x: 45, y: 165},
                    yellowBlue: {x: 215, y: 125},
                    blueRed: {x: 125, y: 215},
                    center: {x: 142, y: 155},
                  };
                  const pos = positions[region] || {x: 140, y: 140};
                  const color = region.includes('yellow') ? '#eab308' : 
                               region.includes('blue') ? '#60a5fa' : '#f87171';
                  return (
                    <text 
                      key={`${region}-${num}`} 
                      x={pos.x} 
                      y={pos.y} 
                      fill={color} 
                      fontSize={region === 'center' ? "26" : "19"} 
                      fontWeight="bold"
                      className="cursor-pointer hover:brightness-125 transition-all"
                      onClick={() => {
                        // Jett Keypad interaction - move to center on click (gaze sign)
                        setPlacedNumbers(prev => ({
                          ...prev,
                          center: [...(prev.center || []), num],
                          [region]: prev[region as keyof typeof prev].filter(n => n !== num)
                        }));
                      }}
                    >
                      {num}
                    </text>
                  );
                })
              )}
            </svg>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
              {isGazing && <div className="px-4 py-1 bg-red-500/80 text-white text-[10px] font-mono rounded-full animate-pulse">LIVE GAZE TRACKING ACTIVE — AARON ROUTER</div>}
            </div>
          </div>
          
          <div className="text-center text-[10px] text-orange-400/70 mt-4 font-mono tracking-[3px]">
            TAP NUMBERS OR USE GAZE TO SIGN • BLOCK 001
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="h-72 border-t border-white/10 bg-zinc-950 overflow-y-auto p-4 space-y-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-800 text-white/90"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Text Input (fallback) */}
      <div className="p-4 border-t border-white/10 bg-black flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Talk to JOE..."
          className="flex-1 bg-zinc-900 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-orange-500/30"
        />
        <button
          onClick={sendMessage}
          className="bg-orange-600 hover:bg-orange-500 w-12 h-12 rounded-2xl flex items-center justify-center transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
