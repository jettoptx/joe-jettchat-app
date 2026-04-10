"use client";

/**
 * useJettChatWS.ts — React hook wrapping JettChatWSClient
 *
 * Manages connection lifecycle, exposes sendMessage + connectionState,
 * and drives automatic exponential-backoff reconnection.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  JettChatWSClient,
  trefoilKnotParams,
  type ConnectionState,
  type PlaintextMessage,
} from "@jettoptx/chat";

const WS_URL =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8765"
    : "ws://localhost:8765";

interface UseJettChatWSOptions {
  /** Wallet/identity pubkey for this client */
  myPubkey: string;
  /** Callback fired for every decrypted inbound message */
  onMessage?: (msg: PlaintextMessage) => void;
  /** Skip connecting (e.g. pubkey not yet available) */
  disabled?: boolean;
}

interface UseJettChatWSReturn {
  connectionState: ConnectionState;
  /** Send plaintext to a recipient — SDK handles encryption */
  sendMessage: (to: string, text: string, isPublic?: boolean) => void;
  /** Force reconnect (useful after network change) */
  reconnect: () => void;
}

export function useJettChatWS({
  myPubkey,
  onMessage,
  disabled = false,
}: UseJettChatWSOptions): UseJettChatWSReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const clientRef = useRef<JettChatWSClient | null>(null);
  const onMessageRef = useRef(onMessage);
  // Keep callback ref current without re-running the connection effect
  onMessageRef.current = onMessage;

  const createClient = useCallback((): JettChatWSClient => {
    const client = new JettChatWSClient({
      url: WS_URL,
      myPubkey,
      knotParams: trefoilKnotParams(),
      reconnectAttempts: 6,
      reconnectBaseDelay: 1000,
    });

    client.onStateChange((state) => setConnectionState(state));

    client.onMessage((msg) => onMessageRef.current?.(msg));

    return client;
  }, [myPubkey]);

  useEffect(() => {
    if (disabled || !myPubkey) return;

    const client = createClient();
    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [myPubkey, disabled, createClient]);

  const sendMessage = useCallback(
    (to: string, text: string, isPublic = false) => {
      const client = clientRef.current;
      if (!client) {
        console.warn("[JettChatWS] sendMessage called before client ready");
        return;
      }
      try {
        client.send(to, text, isPublic);
      } catch (err) {
        console.error("[JettChatWS] send failed:", err);
      }
    },
    []
  );

  const reconnect = useCallback(() => {
    clientRef.current?.disconnect();
    if (disabled || !myPubkey) return;
    const client = createClient();
    clientRef.current = client;
    client.connect();
  }, [myPubkey, disabled, createClient]);

  return { connectionState, sendMessage, reconnect };
}
