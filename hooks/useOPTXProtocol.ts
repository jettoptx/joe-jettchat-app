"use client";

/**
 * useOPTXProtocol.ts — React hook for Jett Optical Trust Protocol on Solana devnet
 *
 * Covers the full GENSYS minting flow:
 *   checkProtocolStatus → createUserEntropy → initiateHandshake
 *   → submitGazeAttestation → submitComputeProof → finalizeAttestation → mintOptx
 *
 * The protocol program at 79nQsecDspUWxvAMyJvK36EUty4yEoP5ssLvHZuNiugF may not
 * yet be initialized. All functions handle that gracefully and surface a clear
 * `protocolInitialized = false` state so the UI can show the init instructions.
 *
 * Luke 18:31
 */

import { useCallback, useEffect, useState } from "react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN, type Idl } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  "79nQsecDspUWxvAMyJvK36EUty4yEoP5ssLvHZuNiugF"
);

export const OPTX_MINT_DEVNET = new PublicKey(
  "4r9WxVWBNMphYfSyGBuMFYRLsLEnzUNquJPnpFessXRH"
);

export const JTX_MINT = new PublicKey(
  "9XpJiKEYzq5yDo5pJzRfjSRMPL2yPfDQXgiN7uYtBhUj"
);

export const CSTB_MINT_DEVNET = new PublicKey(
  "4waAAfTjqf5LNpj2TC5zoeiAgegVwKWoy4WiJgjdBkVL"
);

export const TOKEN_2022_PROGRAM = TOKEN_2022_PROGRAM_ID;

// ─── Inline IDL (Anchor 0.30 format) ─────────────────────────────────────────
// Using `as unknown as Idl` to avoid fighting Anchor's strict generic types
// while still getting runtime program construction working correctly.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OPTX_IDL_RAW: Record<string, any> = {
  version: "0.1.0",
  name: "jett_optical_trust",
  metadata: {
    name: "jett_optical_trust",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "createUserEntropy",
      discriminator: [139, 24, 55, 209, 66, 198, 7, 243],
      accounts: [
        { name: "user", writable: true, signer: true },
        { name: "userEntropy", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [],
    },
    {
      name: "initiateHandshake",
      discriminator: [212, 94, 172, 18, 250, 1, 225, 11],
      accounts: [
        { name: "user", writable: true, signer: true },
        { name: "handshake", writable: true, signer: false },
        { name: "protocolConfig", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [{ name: "handshakeId", type: { array: ["u8", 32] } }],
    },
    {
      name: "submitGazeAttestation",
      discriminator: [67, 151, 29, 8, 54, 231, 175, 202],
      accounts: [
        { name: "user", writable: false, signer: true },
        { name: "handshake", writable: true, signer: false },
        { name: "protocolConfig", writable: false, signer: false },
      ],
      args: [
        { name: "tensorHash", type: { array: ["u8", 32] } },
        { name: "cogVector", type: { array: ["i16", 3] } },
        { name: "emoVector", type: { array: ["i16", 3] } },
        { name: "envVector", type: { array: ["i16", 3] } },
        { name: "durationCs", type: "u64" },
        { name: "gazeEntropy", type: "u64" },
      ],
    },
    {
      name: "submitComputeProof",
      discriminator: [189, 42, 107, 233, 14, 65, 88, 201],
      accounts: [
        { name: "user", writable: false, signer: true },
        { name: "handshake", writable: true, signer: false },
        { name: "protocolConfig", writable: false, signer: false },
      ],
      args: [
        { name: "proofHash", type: { array: ["u8", 32] } },
        { name: "difficulty", type: "u8" },
        { name: "deviceType", type: "u8" },
        { name: "nonce", type: "u64" },
        { name: "computeEntropy", type: "u64" },
      ],
    },
    {
      name: "finalizeAttestation",
      discriminator: [93, 62, 144, 38, 251, 55, 127, 8],
      accounts: [
        { name: "user", writable: true, signer: true },
        { name: "handshake", writable: true, signer: false },
        { name: "attestation", writable: true, signer: false },
        { name: "userEntropy", writable: true, signer: false },
        { name: "protocolConfig", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [],
    },
    {
      name: "mintOptx",
      discriminator: [23, 48, 192, 165, 109, 78, 3, 241],
      accounts: [
        { name: "user", writable: true, signer: true },
        { name: "userEntropy", writable: true, signer: false },
        { name: "protocolConfig", writable: true, signer: false },
        { name: "optxMint", writable: true, signer: false },
        { name: "userOptxAccount", writable: true, signer: false },
        { name: "tokenProgram", writable: false, signer: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
  ],
  accounts: [
    { name: "ProtocolConfig", discriminator: [25, 20, 44, 198, 102, 168, 61, 1] },
    { name: "UserEntropy", discriminator: [157, 44, 231, 19, 123, 7, 189, 52] },
    { name: "Handshake", discriminator: [81, 33, 197, 152, 204, 42, 19, 88] },
    { name: "Attestation", discriminator: [11, 247, 198, 43, 93, 7, 165, 200] },
  ],
  types: [
    {
      name: "ProtocolConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "jtxMint", type: "pubkey" },
          { name: "cstbMint", type: "pubkey" },
          { name: "optxMint", type: "pubkey" },
          { name: "totalHandshakes", type: "u64" },
          { name: "totalAttestations", type: "u64" },
          { name: "totalOptxMinted", type: "u64" },
          { name: "gazeThreshold", type: "u64" },
          { name: "computeDifficultyMin", type: "u8" },
          { name: "entropyPerAttestation", type: "u64" },
          { name: "optxPerEntropy", type: "u64" },
          { name: "paused", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "UserEntropy",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "totalEntropy", type: "u64" },
          { name: "entropyUsed", type: "u64" },
          { name: "attestationCount", type: "u64" },
          { name: "lastAttestation", type: "i64" },
          { name: "optxMintingAllowance", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Handshake",
      type: {
        kind: "struct",
        fields: [
          { name: "initiator", type: "pubkey" },
          { name: "handshakeId", type: { array: ["u8", 32] } },
          { name: "initiatedAt", type: "i64" },
          { name: "expiresAt", type: "i64" },
          { name: "gazeVerified", type: "bool" },
          { name: "gazeVerifiedAt", type: "i64" },
          { name: "gazeTensorHash", type: { array: ["u8", 32] } },
          { name: "cogVector", type: { array: ["i16", 3] } },
          { name: "emoVector", type: { array: ["i16", 3] } },
          { name: "envVector", type: { array: ["i16", 3] } },
          { name: "gazeEntropy", type: "u64" },
          { name: "computeVerified", type: "bool" },
          { name: "computeVerifiedAt", type: "i64" },
          { name: "computeProofHash", type: { array: ["u8", 32] } },
          { name: "difficultyLevel", type: "u8" },
          { name: "deviceType", type: "u8" },
          { name: "proofNonce", type: "u64" },
          { name: "computeEntropy", type: "u64" },
          { name: "attestationComplete", type: "bool" },
          { name: "finalized", type: "bool" },
          { name: "claimed", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Attestation",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "handshakeId", type: { array: ["u8", 32] } },
          { name: "createdAt", type: "i64" },
          { name: "totalEntropy", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "ProtocolNotInitialized", msg: "Protocol not initialized" },
    { code: 6001, name: "ProtocolPaused", msg: "Protocol is paused" },
    { code: 6002, name: "HandshakeExpired", msg: "Handshake has expired" },
    { code: 6003, name: "HandshakeAlreadyFinalized", msg: "Handshake already finalized" },
    { code: 6004, name: "GazeNotVerified", msg: "Gaze attestation not verified" },
    { code: 6005, name: "ComputeNotVerified", msg: "Compute proof not verified" },
    { code: 6006, name: "InsufficientAllowance", msg: "Insufficient minting allowance" },
    { code: 6007, name: "InvalidDifficulty", msg: "Compute difficulty too low" },
  ],
};

const OPTX_IDL = OPTX_IDL_RAW as unknown as Idl;

// ─── PDA helpers ─────────────────────────────────────────────────────────────

export function deriveProtocolConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("protocol-config")],
    PROGRAM_ID
  );
}

export function deriveUserEntropy(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user-entropy"), user.toBuffer()],
    PROGRAM_ID
  );
}

export function deriveHandshake(
  user: PublicKey,
  handshakeId: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("handshake"), user.toBuffer(), Buffer.from(handshakeId)],
    PROGRAM_ID
  );
}

export function deriveAttestation(
  owner: PublicKey,
  handshakeId: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), owner.toBuffer(), Buffer.from(handshakeId)],
    PROGRAM_ID
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProtocolConfig {
  authority: PublicKey;
  jtxMint: PublicKey;
  cstbMint: PublicKey;
  optxMint: PublicKey;
  totalHandshakes: bigint;
  totalAttestations: bigint;
  totalOptxMinted: bigint;
  gazeThreshold: bigint;
  computeDifficultyMin: number;
  entropyPerAttestation: bigint;
  optxPerEntropy: bigint;
  paused: boolean;
  bump: number;
}

export interface UserEntropyAccount {
  owner: PublicKey;
  totalEntropy: bigint;
  entropyUsed: bigint;
  attestationCount: bigint;
  lastAttestation: bigint;
  optxMintingAllowance: bigint;
  bump: number;
}

export interface HandshakeAccount {
  initiator: PublicKey;
  handshakeId: Uint8Array;
  initiatedAt: bigint;
  expiresAt: bigint;
  gazeVerified: boolean;
  computeVerified: boolean;
  attestationComplete: boolean;
  finalized: boolean;
  claimed: boolean;
  bump: number;
}

export interface GazeAttestationData {
  tensorHash: Uint8Array;
  cogVector: [number, number, number];
  emoVector: [number, number, number];
  envVector: [number, number, number];
  durationCs: bigint;
  gazeEntropy: bigint;
}

export interface ComputeProofData {
  proofHash: Uint8Array;
  difficulty: number;
  deviceType: number;
  nonce: bigint;
  computeEntropy: bigint;
}

export interface OPTXProtocolState {
  protocolInitialized: boolean;
  userEntropyExists: boolean;
  currentHandshake: HandshakeAccount | null;
  currentHandshakeId: Uint8Array | null;
  mintingAllowance: bigint;
  protocolConfig: ProtocolConfig | null;
  userEntropy: UserEntropyAccount | null;
  loading: boolean;
  error: string | null;
  txSignature: string | null;
  lastCompletedStep: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOPTXProtocol() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [state, setState] = useState<OPTXProtocolState>({
    protocolInitialized: false,
    userEntropyExists: false,
    currentHandshake: null,
    currentHandshakeId: null,
    mintingAllowance: BigInt(0),
    protocolConfig: null,
    userEntropy: null,
    loading: false,
    error: null,
    txSignature: null,
    lastCompletedStep: null,
  });

  const getProvider = useCallback((): AnchorProvider | null => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  }, [connection, wallet]);

  const getProgram = useCallback((): Program | null => {
    const provider = getProvider();
    if (!provider) return null;
    return new Program(OPTX_IDL, provider);
  }, [getProvider]);

  const setLoading = (loading: boolean) =>
    setState((s) => ({ ...s, loading, error: loading ? null : s.error }));

  const setError = (error: string) =>
    setState((s) => ({ ...s, loading: false, error }));

  // ── checkProtocolStatus ────────────────────────────────────────────────────
  const checkProtocolStatus = useCallback(async (): Promise<void> => {
    try {
      const [configPDA] = deriveProtocolConfig();
      const info = await connection.getAccountInfo(configPDA);
      if (!info) {
        setState((s) => ({ ...s, protocolInitialized: false, protocolConfig: null }));
        return;
      }
      const program = getProgram();
      if (program) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cfg = await (program.account as any)["protocolConfig"].fetch(configPDA);
          const protocolConfig: ProtocolConfig = {
            authority: cfg.authority,
            jtxMint: cfg.jtxMint,
            cstbMint: cfg.cstbMint,
            optxMint: cfg.optxMint,
            totalHandshakes: BigInt(cfg.totalHandshakes.toString()),
            totalAttestations: BigInt(cfg.totalAttestations.toString()),
            totalOptxMinted: BigInt(cfg.totalOptxMinted.toString()),
            gazeThreshold: BigInt(cfg.gazeThreshold.toString()),
            computeDifficultyMin: cfg.computeDifficultyMin,
            entropyPerAttestation: BigInt(cfg.entropyPerAttestation.toString()),
            optxPerEntropy: BigInt(cfg.optxPerEntropy.toString()),
            paused: cfg.paused,
            bump: cfg.bump,
          };
          setState((s) => ({ ...s, protocolInitialized: true, protocolConfig }));
        } catch {
          setState((s) => ({ ...s, protocolInitialized: true }));
        }
      } else {
        setState((s) => ({ ...s, protocolInitialized: true }));
      }
    } catch (err) {
      console.warn("[useOPTXProtocol] checkProtocolStatus:", err);
    }
  }, [connection, getProgram]);

  // ── getUserEntropy ─────────────────────────────────────────────────────────
  const getUserEntropy = useCallback(async (): Promise<void> => {
    if (!wallet.publicKey) return;
    try {
      const [entropyPDA] = deriveUserEntropy(wallet.publicKey);
      const info = await connection.getAccountInfo(entropyPDA);
      if (!info) {
        setState((s) => ({
          ...s,
          userEntropyExists: false,
          userEntropy: null,
          mintingAllowance: BigInt(0),
        }));
        return;
      }
      const program = getProgram();
      if (program) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ue = await (program.account as any)["userEntropy"].fetch(entropyPDA);
          const userEntropy: UserEntropyAccount = {
            owner: ue.owner,
            totalEntropy: BigInt(ue.totalEntropy.toString()),
            entropyUsed: BigInt(ue.entropyUsed.toString()),
            attestationCount: BigInt(ue.attestationCount.toString()),
            lastAttestation: BigInt(ue.lastAttestation.toString()),
            optxMintingAllowance: BigInt(ue.optxMintingAllowance.toString()),
            bump: ue.bump,
          };
          setState((s) => ({
            ...s,
            userEntropyExists: true,
            userEntropy,
            mintingAllowance: userEntropy.optxMintingAllowance,
          }));
        } catch {
          setState((s) => ({ ...s, userEntropyExists: true }));
        }
      } else {
        setState((s) => ({ ...s, userEntropyExists: true }));
      }
    } catch (err) {
      console.warn("[useOPTXProtocol] getUserEntropy:", err);
    }
  }, [connection, wallet.publicKey, getProgram]);

  // ── createUserEntropy ──────────────────────────────────────────────────────
  const createUserEntropy = useCallback(async (): Promise<void> => {
    if (!wallet.publicKey) { setError("Wallet not connected"); return; }
    const program = getProgram();
    if (!program) { setError("Could not build Anchor program"); return; }
    setLoading(true);
    try {
      const [entropyPDA] = deriveUserEntropy(wallet.publicKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = await (program.methods as any)
        .createUserEntropy()
        .accounts({ user: wallet.publicKey, userEntropy: entropyPDA, systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });
      setState((s) => ({
        ...s,
        loading: false,
        userEntropyExists: true,
        txSignature: sig,
        lastCompletedStep: "createUserEntropy",
        error: null,
      }));
      await getUserEntropy();
    } catch (err: unknown) {
      setError(friendlyError(err));
    }
  }, [wallet.publicKey, getProgram, getUserEntropy]);

  // ── initiateHandshake ─────────────────────────────────────────────────────
  const initiateHandshake = useCallback(async (): Promise<void> => {
    if (!wallet.publicKey) { setError("Wallet not connected"); return; }
    const program = getProgram();
    if (!program) { setError("Could not build Anchor program"); return; }
    setLoading(true);
    try {
      const handshakeId = crypto.getRandomValues(new Uint8Array(32));
      const [configPDA] = deriveProtocolConfig();
      const [handshakePDA] = deriveHandshake(wallet.publicKey, handshakeId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = await (program.methods as any)
        .initiateHandshake(Array.from(handshakeId))
        .accounts({ user: wallet.publicKey, handshake: handshakePDA, protocolConfig: configPDA, systemProgram: SystemProgram.programId })
        .rpc({ commitment: "confirmed" });
      setState((s) => ({
        ...s,
        loading: false,
        currentHandshakeId: handshakeId,
        txSignature: sig,
        lastCompletedStep: "initiateHandshake",
        error: null,
      }));
    } catch (err: unknown) {
      setError(friendlyError(err));
    }
  }, [wallet.publicKey, getProgram]);

  // ── submitGazeAttestation ─────────────────────────────────────────────────
  const submitGazeAttestation = useCallback(
    async (gazeData: GazeAttestationData): Promise<void> => {
      if (!wallet.publicKey) { setError("Wallet not connected"); return; }
      const program = getProgram();
      if (!program) { setError("Could not build Anchor program"); return; }
      const handshakeId = state.currentHandshakeId;
      if (!handshakeId) { setError("No active handshake — initiate one first"); return; }
      setLoading(true);
      try {
        const [configPDA] = deriveProtocolConfig();
        const [handshakePDA] = deriveHandshake(wallet.publicKey, handshakeId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sig = await (program.methods as any)
          .submitGazeAttestation(
            Array.from(gazeData.tensorHash),
            gazeData.cogVector,
            gazeData.emoVector,
            gazeData.envVector,
            new BN(gazeData.durationCs.toString()),
            new BN(gazeData.gazeEntropy.toString())
          )
          .accounts({ user: wallet.publicKey, handshake: handshakePDA, protocolConfig: configPDA })
          .rpc({ commitment: "confirmed" });
        setState((s) => ({
          ...s,
          loading: false,
          txSignature: sig,
          lastCompletedStep: "submitGazeAttestation",
          error: null,
        }));
      } catch (err: unknown) {
        setError(friendlyError(err));
      }
    },
    [wallet.publicKey, getProgram, state.currentHandshakeId]
  );

  // ── submitComputeProof ────────────────────────────────────────────────────
  const submitComputeProof = useCallback(
    async (proofData: ComputeProofData): Promise<void> => {
      if (!wallet.publicKey) { setError("Wallet not connected"); return; }
      const program = getProgram();
      if (!program) { setError("Could not build Anchor program"); return; }
      const handshakeId = state.currentHandshakeId;
      if (!handshakeId) { setError("No active handshake"); return; }
      setLoading(true);
      try {
        const [configPDA] = deriveProtocolConfig();
        const [handshakePDA] = deriveHandshake(wallet.publicKey, handshakeId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sig = await (program.methods as any)
          .submitComputeProof(
            Array.from(proofData.proofHash),
            proofData.difficulty,
            proofData.deviceType,
            new BN(proofData.nonce.toString()),
            new BN(proofData.computeEntropy.toString())
          )
          .accounts({ user: wallet.publicKey, handshake: handshakePDA, protocolConfig: configPDA })
          .rpc({ commitment: "confirmed" });
        setState((s) => ({
          ...s,
          loading: false,
          txSignature: sig,
          lastCompletedStep: "submitComputeProof",
          error: null,
        }));
      } catch (err: unknown) {
        setError(friendlyError(err));
      }
    },
    [wallet.publicKey, getProgram, state.currentHandshakeId]
  );

  // ── finalizeAttestation ───────────────────────────────────────────────────
  const finalizeAttestation = useCallback(async (): Promise<void> => {
    if (!wallet.publicKey) { setError("Wallet not connected"); return; }
    const program = getProgram();
    if (!program) { setError("Could not build Anchor program"); return; }
    const handshakeId = state.currentHandshakeId;
    if (!handshakeId) { setError("No active handshake"); return; }
    setLoading(true);
    try {
      const [configPDA] = deriveProtocolConfig();
      const [handshakePDA] = deriveHandshake(wallet.publicKey, handshakeId);
      const [attestationPDA] = deriveAttestation(wallet.publicKey, handshakeId);
      const [entropyPDA] = deriveUserEntropy(wallet.publicKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = await (program.methods as any)
        .finalizeAttestation()
        .accounts({
          user: wallet.publicKey,
          handshake: handshakePDA,
          attestation: attestationPDA,
          userEntropy: entropyPDA,
          protocolConfig: configPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });
      setState((s) => ({
        ...s,
        loading: false,
        txSignature: sig,
        lastCompletedStep: "finalizeAttestation",
        error: null,
      }));
      await getUserEntropy();
    } catch (err: unknown) {
      setError(friendlyError(err));
    }
  }, [wallet.publicKey, getProgram, state.currentHandshakeId, getUserEntropy]);

  // ── mintOptx ──────────────────────────────────────────────────────────────
  const mintOptx = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!wallet.publicKey) { setError("Wallet not connected"); return; }
      const program = getProgram();
      if (!program) { setError("Could not build Anchor program"); return; }
      setLoading(true);
      try {
        const [configPDA] = deriveProtocolConfig();
        const [entropyPDA] = deriveUserEntropy(wallet.publicKey);
        const userOptxAccount = deriveATA(wallet.publicKey, OPTX_MINT_DEVNET, TOKEN_2022_PROGRAM);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sig = await (program.methods as any)
          .mintOptx(new BN(amount.toString()))
          .accounts({
            user: wallet.publicKey,
            userEntropy: entropyPDA,
            protocolConfig: configPDA,
            optxMint: OPTX_MINT_DEVNET,
            userOptxAccount,
            tokenProgram: TOKEN_2022_PROGRAM,
          })
          .rpc({ commitment: "confirmed" });
        setState((s) => ({
          ...s,
          loading: false,
          txSignature: sig,
          lastCompletedStep: "mintOptx",
          error: null,
        }));
        await getUserEntropy();
      } catch (err: unknown) {
        setError(friendlyError(err));
      }
    },
    [wallet.publicKey, getProgram, getUserEntropy]
  );

  // ── Auto-refresh on wallet connect ────────────────────────────────────────
  useEffect(() => {
    if (!wallet.publicKey) return;
    checkProtocolStatus();
    getUserEntropy();
  }, [wallet.publicKey, checkProtocolStatus, getUserEntropy]);

  return {
    ...state,
    checkProtocolStatus,
    createUserEntropy,
    initiateHandshake,
    submitGazeAttestation,
    submitComputeProof,
    finalizeAttestation,
    mintOptx,
    getUserEntropy,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive an associated token account address (works for Token-2022) */
function deriveATA(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bP")
  );
  return ata;
}

/** Convert Anchor / program errors into user-readable messages */
function friendlyError(err: unknown): string {
  const msg: string =
    err instanceof Error ? err.message : String(err);

  if (msg.includes("6000") || msg.includes("ProtocolNotInitialized")) {
    return "Protocol not initialized. Run the init-protocol-devnet script first.";
  }
  if (msg.includes("6001") || msg.includes("ProtocolPaused")) {
    return "Protocol is paused.";
  }
  if (msg.includes("6002") || msg.includes("HandshakeExpired")) {
    return "Handshake expired. Start a new one.";
  }
  if (msg.includes("6003") || msg.includes("AlreadyFinalized")) {
    return "Handshake already finalized.";
  }
  if (msg.includes("6004") || msg.includes("GazeNotVerified")) {
    return "Gaze attestation not verified on-chain.";
  }
  if (msg.includes("6005") || msg.includes("ComputeNotVerified")) {
    return "Compute proof not verified on-chain.";
  }
  if (msg.includes("6006") || msg.includes("InsufficientAllowance")) {
    return "Insufficient OPTX minting allowance. Complete more attestations.";
  }
  if (msg.includes("AccountNotFound") || msg.includes("not found")) {
    return "Account not found. The protocol may not be initialized yet.";
  }
  if (msg.includes("insufficient funds") || msg.includes("0x1")) {
    return "Insufficient SOL for transaction fees. Airdrop devnet SOL first.";
  }
  if (msg.includes("User rejected")) {
    return "Transaction cancelled.";
  }
  return msg.length > 120 ? msg.slice(0, 120) + "\u2026" : msg;
}
