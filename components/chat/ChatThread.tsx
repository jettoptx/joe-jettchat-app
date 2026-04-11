"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Phone, Video, MoreHorizontal, ChevronDown, Wifi, WifiOff, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import { SystemNotice } from "./SystemNotice";
import { AttestationBadge } from "./AttestationBadge";
import { ChatInput } from "./ChatInput";
import { useJettChatWS } from "@/hooks/useJettChatWS";
import { useEncryption } from "@/hooks/useEncryption";
import { useAttestation } from "@/hooks/useAttestation";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { generateMessageId } from "@jettoptx/chat";
import { JTX_MINT } from "@/lib/attestation";
import { useSession } from "@/hooks/useSession";

interface ChatThreadProps {
  threadId: string;
  /** Wallet pubkey for the local user — drives WS identity */
  myPubkey?: string;
  /** Wallet pubkey for the remote peer — used for key exchange */
  peerPublicKey?: string;
  /**
   * Channel slug — if it starts with "#" it is treated as a gated channel
   * and on-chain Merkle attestations are activated (#dojo, #mojo).
   */
  channelSlug?: string;
}

// ─── ATA derivation ───────────────────────────────────────────────────────────
// Derives the associated token account address for the JTX mint without
// requiring @solana/spl-token (not in package.json). Uses the canonical
// ATA program seeds: [walletPubkey, tokenProgram, mint].

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ATA_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv"
);

function deriveATA(walletPubkey: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [walletPubkey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM_ID
  );
  return ata;
}

// Thread metadata resolved from Convex conversation + participants

/** Map WS connection state to a compact status indicator */
function ConnectionIndicator({ state }: { state: string }) {
  if (state === "e2e_ready") {
    return (
      <span className="flex items-center gap-1 text-emerald-400 font-mono text-[9px]" title="E2E encrypted channel active">
        <Lock className="w-3 h-3" />
        E2E
      </span>
    );
  }
  if (state === "connected" || state === "connecting") {
    return (
      <span className="flex items-center gap-1 text-yellow-400 font-mono text-[9px]" title="Establishing encrypted channel…">
        <Wifi className="w-3 h-3 animate-pulse" />
        {state === "connecting" ? "CONNECTING" : "HANDSHAKE"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground font-mono text-[9px]" title="Disconnected">
      <WifiOff className="w-3 h-3" />
      OFFLINE
    </span>
  );
}

export function ChatThread({ threadId, myPubkey, peerPublicKey, channelSlug }: ChatThreadProps) {
  const { session } = useSession();

  // Load conversation metadata from Convex
  const convexConversation = useQuery(
    api.conversations.getById,
    threadId ? { id: threadId as Id<"conversations"> } : "skip"
  );

  // Load message history from Convex (real-time subscription)
  const convexMessages = useQuery(
    api.messages.listByConversation,
    threadId ? { conversationId: threadId as Id<"conversations">, limit: 100 } : "skip"
  );

  // Resolve thread display info from conversation
  const thread = {
    name: convexConversation?.name
      || convexConversation?.participants?.filter((p) => p !== session?.xId).join(", ")
      || "Unknown",
    username: convexConversation?.slug
      || convexConversation?.participants?.find((p) => p !== session?.xId)
      || "unknown",
    verified: false,
    avatarUrl: undefined as string | undefined,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Hydrate local messages from Convex history on first load
  const hydrated = useRef(false);
  useEffect(() => {
    if (convexMessages && !hydrated.current) {
      hydrated.current = true;
      const mapped: ChatMessage[] = convexMessages.map((m) => ({
        id: m._id,
        role: m.senderId === (session?.xId ?? myPubkey) ? "sent" as const : "received" as const,
        content: m.content,
        senderName: m.senderName,
        timestamp: m.createdAt,
        isAI: m.messageType === "joe" || m.messageType === "agent",
      }));
      setMessages(mapped);
    }
  }, [convexMessages, session?.xId, myPubkey]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [e2eNoticeDismissed, setE2eNoticeDismissed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Attestation setup ────────────────────────────────────────────────────
  // Only gated channels (slug starts with "#") get on-chain attestations.
  const isGatedChannel = typeof channelSlug === "string" && channelSlug.startsWith("#");
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  // Derive the JTX ATA for the connected wallet — null when wallet not connected.
  const jtxTokenAccount = useMemo(() => {
    if (!anchorWallet?.publicKey) return null;
    try {
      return deriveATA(anchorWallet.publicKey, JTX_MINT);
    } catch {
      return null;
    }
  }, [anchorWallet?.publicKey]);

  const attestation = useAttestation({
    channel: channelSlug ?? "",
    wallet: anchorWallet ?? null,
    connection: isGatedChannel ? connection : null,
    jtxTokenAccount,
    cluster: (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "devnet" | "mainnet-beta",
  });

  // Track the last confirmed signature so we can insert a system notice exactly once.
  const prevConfirmedSig = useRef<string | null>(null);

  // ── E2E encryption primitives ────────────────────────────────────────────
  const { localPublicKey, ready: encryptionReady, encrypt, decrypt } = useEncryption();

  // Convex persistence — sendMessage mutation
  const persistMessage = useMutation(api.messages.send);

  // WebSocket transport — only connect when we have a pubkey
  const { connectionState, sendMessage } = useJettChatWS({
    myPubkey: myPubkey ?? localPublicKey ?? "",
    disabled: !myPubkey && !localPublicKey,
    onMessage: useCallback(
      (msg: { id?: string; text: string; sender?: string; timestamp?: number }) => {
        // Attempt to decrypt inbound message; fall back to showing
        // a placeholder if peer key isn't available yet
        let content = "[encrypted]";
        if (encryptionReady && peerPublicKey) {
          try {
            content = decrypt(
              { ciphertext: msg.text, nonce: "" },
              threadId,
              peerPublicKey
            );
          } catch {
            // Pre-encrypted via WS session key — display as-is
            content = msg.text;
          }
        } else {
          content = msg.text;
        }

        const chatMsg: ChatMessage = {
          id: msg.id ?? `ws-${Date.now()}`,
          role: "received",
          content,
          senderName: thread.name,
          timestamp: msg.timestamp ?? Date.now(),
          isAI: false,
        };
        setMessages((prev) => [...prev, chatMsg]);
      },
      [encryptionReady, peerPublicKey, threadId, thread.name, decrypt]
    ),
  });

  // Re-show E2E notice on every fresh connection upgrade
  const prevConnectionState = useRef<string>("disconnected");
  useEffect(() => {
    if (
      connectionState === "e2e_ready" &&
      prevConnectionState.current !== "e2e_ready"
    ) {
      setE2eNoticeDismissed(false);
    }
    prevConnectionState.current = connectionState;
  }, [connectionState]);

  // Insert a system notice when a new Merkle-root batch is confirmed on-chain.
  useEffect(() => {
    if (
      attestation.status === "confirmed" &&
      attestation.lastSignature &&
      attestation.lastSignature !== prevConfirmedSig.current
    ) {
      prevConfirmedSig.current = attestation.lastSignature;
      const sig = attestation.lastSignature;
      const shortSig = `${sig.slice(0, 6)}...${sig.slice(-4)}`;
      const noticeMsg: ChatMessage = {
        id: `attestation-notice-${sig}`,
        role: "system",
        content: `\u2713 ${attestation.pendingCount === 0 ? "Batch" : `${attestation.pendingCount} messages`} attested on Solana \u2022 tx: ${shortSig}`,
        senderName: "System",
        timestamp: Date.now(),
        isAI: false,
      };
      setMessages((prev) => [...prev, noticeMsg]);
    }
  }, [attestation.status, attestation.lastSignature, attestation.pendingCount]);

  // Auto-scroll
  useEffect(() => {
    if (!showScrollBtn) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showScrollBtn]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const handleSend = useCallback(
    async (content: string) => {
      const id = generateMessageId();
      const timestamp = Date.now();

      // Optimistic local state
      const outgoing: ChatMessage = {
        id,
        role: "sent",
        content,
        senderName: "You",
        timestamp,
      };
      setMessages((prev) => [...prev, outgoing]);

      // Encrypt for Convex persistence (per-conversation TKDF key)
      let encryptedContent = content;
      let nonce = "";
      if (encryptionReady && peerPublicKey) {
        try {
          const payload = encrypt(content, threadId, peerPublicKey);
          encryptedContent = payload.ciphertext;
          nonce = payload.nonce;
        } catch (err) {
          console.error("[ChatThread] encrypt failed:", err);
        }
      }

      // Transport: send via WebSocket (SDK handles its own session encryption)
      if (connectionState === "e2e_ready") {
        sendMessage(threadId, content);
      }

      // Persist encrypted payload to Convex (dual-write)
      try {
        if (persistMessage) {
          await persistMessage({
            conversationId: threadId as any,
            senderId: myPubkey ?? localPublicKey ?? "anon",
            senderName: "You",
            content: encryptedContent ?? content,
            encryptedContent,
            nonce,
            senderPublicKey: localPublicKey ?? "",
            messageType: "chat",
          });
        }
      } catch (err) {
        console.error("[ChatThread] Convex persist failed:", err);
      }

      // Register this message for on-chain Merkle attestation.
      // addMessage is a no-op when the channel isn't gated — safe to always call.
      // We hash the stable message ID (not the plaintext content) so no message
      // content is ever exposed through the attestation pipeline.
      if (attestation.isActive) {
        attestation.addMessage(id);
      }
    },
    [
      connectionState,
      encryptionReady,
      encrypt,
      peerPublicKey,
      threadId,
      sendMessage,
      persistMessage,
      myPubkey,
      localPublicKey,
      attestation,
    ]
  );

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Thread header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={thread.avatarUrl} />
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-mono">
              {thread.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{thread.name}</span>
              {thread.verified && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/25"
                >
                  ✓
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              @{thread.username}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="w-[18px] h-[18px]" />
          </button>
          <button className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Video className="w-[18px] h-[18px]" />
          </button>
          <button className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-[18px] h-[18px]" />
          </button>
          {/* Connection / E2E indicator */}
          <div className="flex items-center gap-1 ml-1">
            <ConnectionIndicator state={connectionState} />
          </div>

          {/* On-chain attestation badge — visible only for gated channels */}
          {attestation.isActive && (
            <div className="flex items-center ml-1">
              <AttestationBadge
                status={attestation.status}
                pendingCount={attestation.pendingCount}
                batchSize={50}
                explorerUrl={attestation.explorerUrl}
                lastSignature={attestation.lastSignature}
              />
            </div>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 space-y-2 min-h-0"
      >
        {/* Static E2E baseline notice */}
        <SystemNotice type="e2e" />

        {/* Dynamic E2E-ready upgrade notice */}
        {connectionState === "e2e_ready" && !e2eNoticeDismissed && (
          <div className="flex items-center justify-center py-1">
            <button
              onClick={() => setE2eNoticeDismissed(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono hover:bg-emerald-500/20 transition-colors"
            >
              <Lock className="w-3 h-3" />
              Encrypted channel active — TKDF + NaCl SecretBox
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Avatar className="w-16 h-16 mb-4">
              <AvatarImage src={thread.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-display">
                {thread.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-semibold">{thread.name}</h3>
            <p className="text-sm text-muted-foreground font-mono">@{thread.username}</p>
            <p className="text-xs text-muted-foreground mt-3 max-w-xs">
              Messages are end-to-end encrypted. No one outside of this conversation
              can read them.
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          // System / attestation notices use the SystemNotice component
          if (msg.role === "system") {
            return (
              <SystemNotice key={msg.id} type="info" message={msg.content} />
            );
          }

          const prevMsg = messages[i - 1];
          const showAvatar =
            !prevMsg || prevMsg.role !== msg.role || msg.timestamp - prevMsg.timestamp > 60000;
          return (
            <MessageBubble key={msg.id} message={msg} showAvatar={showAvatar} />
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="secondary"
            className="rounded-full border border-border shadow-lg text-[10px] font-mono gap-1"
          >
            <ChevronDown className="w-3 h-3" /> New messages
          </Button>
        </div>
      )}

      {/* Input bar */}
      <ChatInput onSend={handleSend} placeholder={`Message @${thread.username}`} />
    </div>
  );
}
