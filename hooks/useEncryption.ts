"use client";

/**
 * useEncryption.ts — Per-conversation E2E encryption hook
 *
 * Uses the @jettoptx/chat SDK (X25519 + NaCl SecretBox + TKDF).
 * Keys are loaded from IndexedDB via keystore.ts.
 * All crypto happens client-side — nothing plaintext leaves the browser.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
  trefoilKnotParams,
  deriveConversationSeed,
  deriveRootKey,
  deriveMessageKey,
  type KeyPair,
  type EncryptedPayload,
} from "@jettoptx/chat";
import { getOrCreateKeyPair } from "@/lib/keystore";
import { encodeBase64 } from "tweetnacl-util";

interface UseEncryptionReturn {
  /** Base64 public key of this client — share with peers */
  localPublicKey: string | null;
  /** true once key pair is loaded from IDB and ready */
  ready: boolean;
  /** Encrypt a plaintext message for a given conversation */
  encrypt: (
    plaintext: string,
    conversationId: string,
    peerPublicKeyB64: string
  ) => EncryptedPayload;
  /** Decrypt an incoming payload */
  decrypt: (
    payload: EncryptedPayload,
    conversationId: string,
    senderPublicKeyB64: string,
    messageCounter?: number
  ) => string;
  /** Error from key initialisation */
  initError: Error | null;
}

export function useEncryption(): UseEncryptionReturn {
  const [localPublicKey, setLocalPublicKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const keyPairRef = useRef<KeyPair | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const kp = await getOrCreateKeyPair();
        if (cancelled) return;
        keyPairRef.current = kp;
        setLocalPublicKey(encodeBase64(kp.publicKey));
        setReady(true);
      } catch (err) {
        if (!cancelled) setInitError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Derives a per-conversation session key using TKDF (trefoil knot params).
   * The key is deterministic for the same pair of participants.
   */
  const deriveSessionKey = useCallback(
    (myId: string, peerId: string, peerPublicKeyBytes: Uint8Array): Uint8Array => {
      if (!keyPairRef.current) throw new Error("Keys not ready");
      const sharedSecret = deriveSharedSecret(keyPairRef.current.secretKey, peerPublicKeyBytes);
      const seed = deriveConversationSeed(myId, peerId);
      const { rootKey } = deriveRootKey(sharedSecret, seed, trefoilKnotParams());
      return rootKey;
    },
    []
  );

  const encrypt = useCallback(
    (
      plaintext: string,
      conversationId: string,
      peerPublicKeyB64: string
    ): EncryptedPayload => {
      if (!keyPairRef.current || !localPublicKey) {
        throw new Error("Encryption not ready — key pair not loaded");
      }

      const { decodeBase64 } = require("tweetnacl-util") as typeof import("tweetnacl-util");
      const peerPubKeyBytes = decodeBase64(peerPublicKeyB64);
      const sessionKey = deriveSessionKey(localPublicKey, conversationId, peerPubKeyBytes);
      return encryptMessage(plaintext, sessionKey);
    },
    [localPublicKey, deriveSessionKey]
  );

  const decrypt = useCallback(
    (
      payload: EncryptedPayload,
      conversationId: string,
      senderPublicKeyB64: string,
      messageCounter?: number
    ): string => {
      if (!keyPairRef.current || !localPublicKey) {
        throw new Error("Decryption not ready — key pair not loaded");
      }

      const { decodeBase64 } = require("tweetnacl-util") as typeof import("tweetnacl-util");
      const senderPubKeyBytes = decodeBase64(senderPublicKeyB64);
      const rootKey = deriveSessionKey(localPublicKey, conversationId, senderPubKeyBytes);

      // If a counter is provided, ratchet to the per-message key for forward secrecy
      const sessionKey =
        messageCounter !== undefined
          ? deriveMessageKey(rootKey, messageCounter)
          : rootKey;

      return decryptMessage(payload, sessionKey);
    },
    [localPublicKey, deriveSessionKey]
  );

  return { localPublicKey, ready, encrypt, decrypt, initError };
}
