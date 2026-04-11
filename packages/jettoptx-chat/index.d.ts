interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
interface EncryptedPayload {
    ciphertext: string;
    nonce: string;
}
declare function generateKeyPair(): KeyPair;
declare function deriveSharedSecret(mySecretKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array;
declare function encryptMessage(plaintext: string, sessionKey: Uint8Array): EncryptedPayload;
declare function decryptMessage(payload: EncryptedPayload, sessionKey: Uint8Array): string;
/**
 * Encrypt with asymmetric box (for handshake / key exchange)
 */
declare function boxEncrypt(plaintext: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;
/**
 * Decrypt asymmetric box (nonce prepended to ciphertext)
 */
declare function boxDecrypt(combined: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;

interface KnotParams {
    alexanderEval: Float64Array;
    jonesEval: Float64Array;
    writhe: number;
}
interface TKDFResult {
    rootKey: Uint8Array;
    knotParamsUsed: boolean;
}
/**
 * Derive conversation seed from sorted participant pubkeys.
 * Same two users always produce the same seed.
 */
declare function deriveConversationSeed(pubkeyA: string, pubkeyB: string): Uint8Array;
/**
 * Derive hybrid root key using TKDF.
 * Falls back to plain shared_secret if knot params unavailable.
 */
declare function deriveRootKey(sharedSecret: Uint8Array, conversationSeed: Uint8Array, knotParams?: KnotParams): TKDFResult;
/**
 * Per-message ratchet: derive message key from root key + counter.
 * Provides forward secrecy — compromise of one message key doesn't
 * reveal keys for other messages.
 */
declare function deriveMessageKey(rootKey: Uint8Array, messageCounter: number): Uint8Array;
/**
 * Default knot params for trefoil knot (3₁) — the simplest non-trivial knot.
 * Used as the default TKDF knot when no custom knot is specified.
 */
declare function trefoilKnotParams(): KnotParams;

/**
 * Session key management — orchestrates E2E + TKDF
 */

interface SessionKeys {
    keyPair: KeyPair;
    sharedSecret: Uint8Array | null;
    rootKey: Uint8Array | null;
    messageCounter: number;
    tkdfEnabled: boolean;
}
declare function createSession(): SessionKeys;
declare function completeHandshake(session: SessionKeys, theirPublicKey: Uint8Array, myPubkeyBase58: string, theirPubkeyBase58: string, knotParams?: KnotParams): SessionKeys;
declare function nextMessageKey(session: SessionKeys): {
    key: Uint8Array;
    session: SessionKeys;
};

interface JettChatMessage {
    id: string;
    from: string;
    to: string;
    content: Uint8Array;
    nonce: Uint8Array;
    timestamp: number;
    public: boolean;
    type: "text" | "system" | "x_activity" | "agent";
}
interface PlaintextMessage {
    id: string;
    from: string;
    to: string;
    text: string;
    timestamp: number;
    public: boolean;
    type: JettChatMessage["type"];
}
declare function generateMessageId(): string;

interface JettChatChannel {
    id: string;
    name: string;
    type: "global" | "dm" | "group" | "agent";
    participants: string[];
    created: number;
}
declare const GLOBAL_CHANNEL: JettChatChannel;
declare function createDMChannel(participantA: string, participantB: string): JettChatChannel;

interface JettChatUser {
    id: string;
    x_handle?: string;
    x_id?: string;
    wallets: string[];
    message_count: number;
    is_agent: boolean;
    display_name?: string;
    avatar_url?: string;
    created: number;
}
type IdentityType = "wallet" | "x_handle" | "agent";
declare function resolveIdentityType(id: string): IdentityType;
declare function displayName(user: JettChatUser): string;

type ConnectionState = "disconnected" | "connecting" | "connected" | "e2e_ready";
interface WSClientConfig {
    url: string;
    myPubkey: string;
    knotParams?: KnotParams;
    reconnectAttempts?: number;
    reconnectBaseDelay?: number;
}
type MessageCallback = (msg: PlaintextMessage) => void;
type StateCallback = (state: ConnectionState) => void;
declare class JettChatWSClient {
    private ws;
    private session;
    private config;
    private state;
    private messageCallbacks;
    private stateCallbacks;
    private reconnectCount;
    constructor(config: WSClientConfig);
    connect(): void;
    disconnect(): void;
    send(to: string, text: string, isPublic?: boolean): void;
    onMessage(cb: MessageCallback): () => void;
    onStateChange(cb: StateCallback): () => void;
    getState(): ConnectionState;
    private setState;
    private initiateHandshake;
    private handleMessage;
    private maybeReconnect;
}

/**
 * X Activity API SSE consumer
 * Connects to /api/x/stream (our SSE proxy) to receive real-time X events
 */
interface XActivityEvent {
    event_type: string;
    data: Record<string, unknown>;
    timestamp: string;
}
type ActivityCallback = (event: XActivityEvent) => void;
declare class XActivityStream {
    private eventSource;
    private callbacks;
    private url;
    constructor(streamUrl?: string);
    connect(): void;
    disconnect(): void;
    onEvent(cb: ActivityCallback): () => void;
    isConnected(): boolean;
}

/**
 * Matrix/Conduit bridge — relays messages to/from the OPTX Matrix homeserver
 * Conduit server: matrix.jettoptics.ai (Jetson :6167)
 * Room: #optx:jettoptics.ai
 */
interface MatrixConfig {
    homeserverUrl: string;
    accessToken: string;
    roomId: string;
}
interface MatrixMessage {
    event_id: string;
    sender: string;
    body: string;
    timestamp: number;
}
type MatrixCallback = (msg: MatrixMessage) => void;
declare class MatrixBridge {
    private config;
    private callbacks;
    private syncToken;
    private polling;
    constructor(config: MatrixConfig);
    sendMessage(body: string): Promise<string>;
    startPolling(): void;
    stopPolling(): void;
    onMessage(cb: MatrixCallback): () => void;
    private poll;
}

export { type ActivityCallback, type ConnectionState, type EncryptedPayload, GLOBAL_CHANNEL, type IdentityType, type JettChatChannel, type JettChatMessage, type JettChatUser, JettChatWSClient, type KeyPair, type KnotParams, MatrixBridge, type MatrixConfig, type MatrixMessage, type PlaintextMessage, type SessionKeys, type TKDFResult, type WSClientConfig, type XActivityEvent, XActivityStream, boxDecrypt, boxEncrypt, completeHandshake, createDMChannel, createSession, decryptMessage, deriveConversationSeed, deriveMessageKey, deriveRootKey, deriveSharedSecret, displayName, encryptMessage, generateKeyPair, generateMessageId, nextMessageKey, resolveIdentityType, trefoilKnotParams };
