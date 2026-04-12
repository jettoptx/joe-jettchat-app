"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

export default function VoicePage() {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([
    { role: 'assistant', content: "Hey bud, I'm Voice JOE. No login required. What's on your mind?" }
  ]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Connect to JOE WebSocket (public endpoint)
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://joe.jettoptx.chat';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to Voice JOE WS');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat' || data.text) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: data.text || data.content || JSON.stringify(data)
          }]);
        }
      } catch (e) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: event.data 
        }]);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => ws.close();
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    
    const message = {
      type: "chat",
      content: input,
      timestamp: Date.now()
    };
    
    wsRef.current.send(JSON.stringify(message));
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-mono text-sm">VOICE JOE — PUBLIC (no login)</span>
        </div>
        <div className="text-xs text-white/50 font-mono">jettoptx.chat/voice</div>
      </div>

      {/* Voice Orb */}
      <div className="flex-1 flex items-center justify-center relative">
        <div 
          onClick={() => setIsListening(!isListening)}
          className={`w-64 h-64 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 border-4 border-orange-500/30
            ${isListening ? 'bg-orange-500/20 scale-110' : 'bg-white/5 hover:bg-white/10'}`}
        >
          <div className="text-center">
            <div className="text-6xl mb-2">🛰️</div>
            <div className="font-mono text-orange-400 text-sm tracking-[4px]">JOE</div>
            <div className="text-[10px] text-white/40 mt-1">TAP TO {isListening ? 'STOP' : 'SPEAK'}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-80 border-t border-white/10 bg-zinc-950 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
              msg.role === 'user' 
                ? 'bg-orange-600 text-white' 
                : 'bg-zinc-800 text-white/90'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10 bg-black flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Talk to JOE..."
          className="flex-1 bg-zinc-900 border border-white/10 rounded-2xl px-5 py-3 text-white placeholder:text-white/40 focus:outline-none"
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
