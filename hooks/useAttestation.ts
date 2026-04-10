"use client";

/**
 * useAttestation.ts — React hook for batched Merkle attestations in JettChat
 *
 * Behaviour:
 *   - Accumulates message hashes in memory for the active gated channel.
 *   - Flushes automatically every FLUSH_INTERVAL_MS (60 s) OR every BATCH_SIZE messages,
 *     whichever comes first.
 *   - Only active for GATED_CHANNELS (#dojo, #mojo); no-ops silently for public channels.
 *   - Exposes status for UI feedback: "idle" | "building" | "pending" | "confirmed" | "error".
 *
 * Usage:
 *   const { addMessage, status, lastSignature, lastRoot } = useAttestation({
 *     channel: "#dojo",
 *     wallet,
 *     connection,
 *     jtxTokenAccount,
 *   });
 *
 * Luke 18:31
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  buildMerkleTree,
  submitAttestation,
  sha256Str,
  GATED_CHANNELS,
  type GatedChannel,
  type AttestationResult,
} from "@/lib/attestation";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Auto-flush every 60 seconds */
const FLUSH_INTERVAL_MS = 60_000;

/** Auto-flush when this many messages have accumulated */
const BATCH_SIZE = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttestationStatus =
  | "idle"       // waiting for messages
  | "building"   // computing Merkle tree
  | "pending"    // tx submitted, awaiting confirmation
  | "confirmed"  // last tx confirmed
  | "error";     // last tx failed

export interface AttestationState {
  status: AttestationStatus;
  /** Pending message count (not yet attested) */
  pendingCount: number;
  /** Last confirmed tx signature */
  lastSignature: string | null;
  /** Last confirmed Merkle root (hex) */
  lastRoot: string | null;
  /** Last batch index that was confirmed on-chain */
  lastBatchIndex: bigint | null;
  /** Last confirmed timestamp (Unix) */
  lastTimestamp: number | null;
  /** Error message if status === "error" */
  errorMessage: string | null;
  /** Solscan URL for the last confirmed tx (devnet) */
  explorerUrl: string | null;
}

export interface UseAttestationOptions {
  /** Channel slug — only #dojo and #mojo trigger attestations */
  channel: string;
  /** Wallet adapter wallet (must be connected) */
  wallet: AnchorWallet | null;
  /** Solana RPC connection */
  connection: Connection | null;
  /** Attester's associated JTX token account */
  jtxTokenAccount: PublicKey | null;
  /** Override flush interval in ms (for testing) */
  flushIntervalMs?: number;
  /** Override batch size (for testing) */
  batchSize?: number;
  /** Cluster for explorer links ("devnet" | "mainnet-beta") */
  cluster?: "devnet" | "mainnet-beta";
}

export interface UseAttestationReturn extends AttestationState {
  /**
   * Register a message for attestation.
   * Call this whenever a message is sent or received in the channel.
   * @param messageId - stable unique ID (Convex _id, UUID, etc.)
   */
  addMessage: (messageId: string) => void;
  /**
   * Manually trigger an immediate flush of the pending batch.
   * No-op if there are no pending messages or the channel is not gated.
   */
  flushNow: () => Promise<void>;
  /** Whether this channel is gated and attestations are active */
  isActive: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAttestation({
  channel,
  wallet,
  connection,
  jtxTokenAccount,
  flushIntervalMs = FLUSH_INTERVAL_MS,
  batchSize = BATCH_SIZE,
  cluster = "devnet",
}: UseAttestationOptions): UseAttestationReturn {
  // Is this channel subject to attestations?
  const isActive = (GATED_CHANNELS as readonly string[]).includes(channel);
  const channelSlug = isActive ? (channel as GatedChannel) : null;

  // Pending message IDs not yet attested
  const pendingRef = useRef<string[]>([]);

  const [state, setState] = useState<AttestationState>({
    status: "idle",
    pendingCount: 0,
    lastSignature: null,
    lastRoot: null,
    lastBatchIndex: null,
    lastTimestamp: null,
    errorMessage: null,
    explorerUrl: null,
  });

  // Stable flush function — defined with useCallback so the interval effect
  // can reference it without re-registering the timer on every render.
  const flush = useCallback(async (): Promise<void> => {
    if (!isActive || !channelSlug) return;
    if (pendingRef.current.length === 0) return;
    if (!wallet || !connection || !jtxTokenAccount) {
      // Wallet not ready — silently skip; messages stay in buffer
      return;
    }

    // Snapshot + drain the buffer atomically
    const batch = pendingRef.current.splice(0, pendingRef.current.length);
    if (batch.length === 0) return;

    setState((prev) => ({
      ...prev,
      status: "building",
      pendingCount: pendingRef.current.length,
    }));

    try {
      // 1. Hash each message ID → SHA-256 leaf
      const hashes = await Promise.all(batch.map((id) => sha256Str(id)));
      const hexHashes = hashes.map((h) =>
        Array.from(h)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      );

      // 2. Build Merkle tree
      const tree = await buildMerkleTree(hexHashes);

      setState((prev) => ({ ...prev, status: "pending" }));

      // 3. Submit to Solana
      const result: AttestationResult = await submitAttestation(
        { connection, wallet, jtxTokenAccount },
        channelSlug,
        tree.root,
        batch.length
      );

      const explorerUrl = buildExplorerUrl(result.signature, cluster);

      setState({
        status: "confirmed",
        pendingCount: pendingRef.current.length,
        lastSignature: result.signature,
        lastRoot: result.merkleRoot,
        lastBatchIndex: result.batchIndex,
        lastTimestamp: result.timestamp,
        errorMessage: null,
        explorerUrl,
      });

      console.info(
        `[useAttestation] ${channelSlug} batch ${result.batchIndex} confirmed — ` +
          `${batch.length} msgs, root ${result.merkleRoot.slice(0, 12)}…, tx ${result.signature}`
      );
    } catch (err) {
      // On failure, return messages to the front of the buffer so they are
      // included in the next flush attempt.
      pendingRef.current = [...batch, ...pendingRef.current];

      const errorMessage =
        err instanceof Error ? err.message : "Unknown attestation error";

      console.error("[useAttestation] flush failed:", err);

      setState((prev) => ({
        ...prev,
        status: "error",
        pendingCount: pendingRef.current.length,
        errorMessage,
      }));
    }
  }, [isActive, channelSlug, wallet, connection, jtxTokenAccount, cluster]);

  // ── Auto-flush timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      flush();
    }, flushIntervalMs);

    return () => clearInterval(timer);
  }, [isActive, flush, flushIntervalMs]);

  // ── addMessage ──────────────────────────────────────────────────────────────
  const addMessage = useCallback(
    (messageId: string) => {
      if (!isActive) return;

      pendingRef.current.push(messageId);

      setState((prev) => ({
        ...prev,
        // Reset error state once new messages arrive after an error
        status: prev.status === "error" ? "idle" : prev.status,
        errorMessage: prev.status === "error" ? null : prev.errorMessage,
        pendingCount: pendingRef.current.length,
      }));

      // Trigger immediate flush if batch size threshold reached
      if (pendingRef.current.length >= batchSize) {
        // Non-blocking: fire and forget, errors surface in state
        flush();
      }
    },
    [isActive, batchSize, flush]
  );

  // ── flushNow ─────────────────────────────────────────────────────────────────
  const flushNow = useCallback(async (): Promise<void> => {
    await flush();
  }, [flush]);

  // ── Cleanup on channel change ─────────────────────────────────────────────
  useEffect(() => {
    // When the channel changes, abandon the old buffer — don't attest
    // messages from a previous channel to the new one's PDA.
    pendingRef.current = [];
    setState({
      status: "idle",
      pendingCount: 0,
      lastSignature: null,
      lastRoot: null,
      lastBatchIndex: null,
      lastTimestamp: null,
      errorMessage: null,
      explorerUrl: null,
    });
  }, [channel]);

  return {
    ...state,
    addMessage,
    flushNow,
    isActive,
  };
}

// ─── Explorer URL ─────────────────────────────────────────────────────────────

function buildExplorerUrl(
  signature: string,
  cluster: "devnet" | "mainnet-beta"
): string {
  const clusterParam =
    cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${clusterParam}`;
}
