"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Send, Volume2, VolumeX } from "lucide-react";

// Extend Window for webkit prefix
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export default function VoicePage() {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([
    {
      role: "assistant",
      content:
        "Howdy, I'm Voice JOE. No login required. What's on your mind?",
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
                alt="Voice JOE"
                width={56}
                height={56}
                className="object-contain drop-shadow-[0_0_30px_rgb(249,115,22)]"
                priority
              />
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
                  : "TAP TO SPEAK"}
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
