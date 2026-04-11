// src/encryption/e2e.ts
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
function generateKeyPair() {
  return nacl.box.keyPair();
}
function deriveSharedSecret(mySecretKey, theirPublicKey) {
  return nacl.box.before(theirPublicKey, mySecretKey);
}
function encryptMessage(plaintext, sessionKey) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = new TextEncoder().encode(plaintext);
  const ciphertext = nacl.secretbox(messageBytes, nonce, sessionKey);
  if (!ciphertext) throw new Error("Encryption failed");
  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce)
  };
}
function decryptMessage(payload, sessionKey) {
  const ciphertext = decodeBase64(payload.ciphertext);
  const nonce = decodeBase64(payload.nonce);
  const plaintext = nacl.secretbox.open(ciphertext, nonce, sessionKey);
  if (!plaintext) throw new Error("Decryption failed \u2014 invalid key or tampered ciphertext");
  return new TextDecoder().decode(plaintext);
}
function boxEncrypt(plaintext, theirPublicKey, mySecretKey) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(plaintext, nonce, theirPublicKey, mySecretKey);
  if (!ciphertext) throw new Error("Box encryption failed");
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);
  return combined;
}
function boxDecrypt(combined, theirPublicKey, mySecretKey) {
  const nonce = combined.slice(0, nacl.box.nonceLength);
  const ciphertext = combined.slice(nacl.box.nonceLength);
  const plaintext = nacl.box.open(ciphertext, nonce, theirPublicKey, mySecretKey);
  if (!plaintext) throw new Error("Box decryption failed");
  return plaintext;
}

// src/encryption/tkdf.ts
import { shake256 } from "js-sha3";
var DOMAIN_SEPARATOR = "OPTX-TKDF-v1.0\0";
function deriveConversationSeed(pubkeyA, pubkeyB) {
  const sorted = [pubkeyA, pubkeyB].sort();
  const input = new TextEncoder().encode(sorted.join(":"));
  const hash = shake256.create(256);
  hash.update(Array.from(input));
  return new Uint8Array(hash.arrayBuffer());
}
function deriveRootKey(sharedSecret, conversationSeed, knotParams) {
  if (!knotParams) {
    const hash2 = shake256.create(256);
    hash2.update(Array.from(sharedSecret));
    hash2.update(Array.from(conversationSeed));
    return {
      rootKey: new Uint8Array(hash2.arrayBuffer()),
      knotParamsUsed: false
    };
  }
  const hash = shake256.create(256);
  hash.update(Array.from(new TextEncoder().encode(DOMAIN_SEPARATOR)));
  hash.update(Array.from(new Uint8Array(knotParams.alexanderEval.buffer)));
  hash.update(Array.from(new Uint8Array(knotParams.jonesEval.buffer)));
  const writheBuf = new ArrayBuffer(4);
  new DataView(writheBuf).setInt32(0, knotParams.writhe, false);
  hash.update(Array.from(new Uint8Array(writheBuf)));
  hash.update(Array.from(conversationSeed));
  hash.update(Array.from(sharedSecret));
  return {
    rootKey: new Uint8Array(hash.arrayBuffer()),
    knotParamsUsed: true
  };
}
function deriveMessageKey(rootKey, messageCounter) {
  const hash = shake256.create(256);
  hash.update(Array.from(rootKey));
  const counterBuf = new ArrayBuffer(8);
  new DataView(counterBuf).setBigUint64(0, BigInt(messageCounter), false);
  hash.update(Array.from(new Uint8Array(counterBuf)));
  return new Uint8Array(hash.arrayBuffer());
}
function trefoilKnotParams() {
  const alexander = new Float64Array(2);
  alexander[0] = -2;
  alexander[1] = 0;
  const jones = new Float64Array(2);
  jones[0] = -1;
  jones[1] = 1.732;
  return {
    alexanderEval: alexander,
    jonesEval: jones,
    writhe: 3
  };
}

// src/encryption/keys.ts
function createSession() {
  return {
    keyPair: generateKeyPair(),
    sharedSecret: null,
    rootKey: null,
    messageCounter: 0,
    tkdfEnabled: false
  };
}
function completeHandshake(session, theirPublicKey, myPubkeyBase58, theirPubkeyBase58, knotParams) {
  const sharedSecret = deriveSharedSecret(session.keyPair.secretKey, theirPublicKey);
  const conversationSeed = deriveConversationSeed(myPubkeyBase58, theirPubkeyBase58);
  const result = deriveRootKey(sharedSecret, conversationSeed, knotParams);
  return {
    ...session,
    sharedSecret,
    rootKey: result.rootKey,
    messageCounter: 0,
    tkdfEnabled: result.knotParamsUsed
  };
}
function nextMessageKey(session) {
  if (!session.rootKey) {
    throw new Error("Session handshake not complete");
  }
  const key = deriveMessageKey(session.rootKey, session.messageCounter);
  return {
    key,
    session: { ...session, messageCounter: session.messageCounter + 1 }
  };
}

// src/models/message.ts
function generateMessageId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

// src/models/channel.ts
var GLOBAL_CHANNEL = {
  id: "jettchat-global",
  name: "#JettChat",
  type: "global",
  participants: [],
  // open to all authenticated users
  created: 0
};
function createDMChannel(participantA, participantB) {
  const sorted = [participantA, participantB].sort();
  return {
    id: `dm:${sorted[0]}:${sorted[1]}`,
    name: `DM`,
    type: "dm",
    participants: sorted,
    created: Date.now()
  };
}

// src/models/identity.ts
function resolveIdentityType(id) {
  if (id.startsWith("agent:")) return "agent";
  if (id.startsWith("@") || /^[a-zA-Z0-9_]{1,15}$/.test(id)) return "x_handle";
  return "wallet";
}
function displayName(user) {
  if (user.display_name) return user.display_name;
  if (user.x_handle) return `@${user.x_handle}`;
  if (user.is_agent) return `Agent:${user.id.slice(0, 8)}`;
  return `${user.id.slice(0, 4)}...${user.id.slice(-4)}`;
}

// src/transport/websocket.ts
import { encodeBase64 as encodeBase642, decodeBase64 as decodeBase642 } from "tweetnacl-util";
var JettChatWSClient = class {
  constructor(config) {
    this.ws = null;
    this.state = "disconnected";
    this.messageCallbacks = /* @__PURE__ */ new Set();
    this.stateCallbacks = /* @__PURE__ */ new Set();
    this.reconnectCount = 0;
    this.config = config;
    this.session = createSession();
  }
  connect() {
    if (this.ws) return;
    this.setState("connecting");
    this.ws = new WebSocket(this.config.url);
    this.ws.onopen = () => {
      this.setState("connected");
      this.reconnectCount = 0;
      this.initiateHandshake();
    };
    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    this.ws.onclose = () => {
      this.ws = null;
      this.setState("disconnected");
      this.maybeReconnect();
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }
  disconnect() {
    this.reconnectCount = Infinity;
    this.ws?.close();
    this.ws = null;
    this.setState("disconnected");
  }
  send(to, text, isPublic = false) {
    if (!this.session.rootKey || !this.ws) {
      throw new Error("Not connected or E2E not ready");
    }
    const { key, session } = nextMessageKey(this.session);
    this.session = session;
    const encrypted = encryptMessage(text, key);
    const msg = {
      type: "message",
      id: generateMessageId(),
      from: this.config.myPubkey,
      to,
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      timestamp: Date.now(),
      public: isPublic,
      msg_type: "text",
      counter: this.session.messageCounter - 1
    };
    this.ws.send(JSON.stringify(msg));
  }
  onMessage(cb) {
    this.messageCallbacks.add(cb);
    return () => this.messageCallbacks.delete(cb);
  }
  onStateChange(cb) {
    this.stateCallbacks.add(cb);
    return () => this.stateCallbacks.delete(cb);
  }
  getState() {
    return this.state;
  }
  setState(state) {
    this.state = state;
    this.stateCallbacks.forEach((cb) => cb(state));
  }
  initiateHandshake() {
    const pubKeyB64 = encodeBase642(this.session.keyPair.publicKey);
    this.ws?.send(
      JSON.stringify({ type: "handshake", public_key: pubKeyB64 })
    );
  }
  handleMessage(data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "handshake_response") {
        const serverPubKey = decodeBase642(parsed.public_key);
        const encryptedSessionKey = decodeBase642(parsed.session_key);
        const sessionKey = boxDecrypt(
          encryptedSessionKey,
          serverPubKey,
          this.session.keyPair.secretKey
        );
        this.session = completeHandshake(
          this.session,
          serverPubKey,
          this.config.myPubkey,
          parsed.server_id ?? "server",
          this.config.knotParams
        );
        this.setState("e2e_ready");
        return;
      }
      if (parsed.type === "message" && this.session.rootKey) {
        const { key } = nextMessageKey({
          ...this.session,
          messageCounter: parsed.counter ?? 0
        });
        const text = decryptMessage(
          { ciphertext: parsed.ciphertext, nonce: parsed.nonce },
          key
        );
        const msg = {
          id: parsed.id,
          from: parsed.from,
          to: parsed.to,
          text,
          timestamp: parsed.timestamp,
          public: parsed.public ?? false,
          type: parsed.msg_type ?? "text"
        };
        this.messageCallbacks.forEach((cb) => cb(msg));
      }
    } catch {
    }
  }
  maybeReconnect() {
    const maxAttempts = this.config.reconnectAttempts ?? 5;
    const baseDelay = this.config.reconnectBaseDelay ?? 1e3;
    if (this.reconnectCount >= maxAttempts) return;
    const delay = baseDelay * Math.pow(2, this.reconnectCount);
    this.reconnectCount++;
    setTimeout(() => {
      this.session = createSession();
      this.connect();
    }, delay);
  }
};

// src/transport/activity-stream.ts
var XActivityStream = class {
  constructor(streamUrl = "/api/x/stream") {
    this.eventSource = null;
    this.callbacks = /* @__PURE__ */ new Set();
    this.url = streamUrl;
  }
  connect() {
    if (this.eventSource) return;
    this.eventSource = new EventSource(this.url);
    this.eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.callbacks.forEach((cb) => cb(parsed));
      } catch {
      }
    };
    this.eventSource.onerror = () => {
    };
  }
  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }
  onEvent(cb) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }
  isConnected() {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
};

// src/transport/matrix-bridge.ts
var MatrixBridge = class {
  constructor(config) {
    this.callbacks = /* @__PURE__ */ new Set();
    this.syncToken = null;
    this.polling = false;
    this.config = config;
  }
  async sendMessage(body) {
    const txnId = `jettchat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = `${this.config.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(this.config.roomId)}/send/m.room.message/${txnId}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        msgtype: "m.text",
        body
      })
    });
    if (!res.ok) throw new Error(`Matrix send failed: ${res.status}`);
    const data = await res.json();
    return data.event_id;
  }
  startPolling() {
    if (this.polling) return;
    this.polling = true;
    this.poll();
  }
  stopPolling() {
    this.polling = false;
  }
  onMessage(cb) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }
  async poll() {
    while (this.polling) {
      try {
        const params = new URLSearchParams({
          timeout: "30000",
          filter: JSON.stringify({
            room: {
              rooms: [this.config.roomId],
              timeline: { limit: 20 }
            }
          })
        });
        if (this.syncToken) params.set("since", this.syncToken);
        const url = `${this.config.homeserverUrl}/_matrix/client/v3/sync?${params}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.config.accessToken}` }
        });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 5e3));
          continue;
        }
        const data = await res.json();
        this.syncToken = data.next_batch;
        const roomData = data.rooms?.join?.[this.config.roomId];
        const events = roomData?.timeline?.events ?? [];
        for (const event of events) {
          if (event.type === "m.room.message") {
            const msg = {
              event_id: event.event_id,
              sender: event.sender,
              body: event.content?.body ?? "",
              timestamp: event.origin_server_ts
            };
            this.callbacks.forEach((cb) => cb(msg));
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, 5e3));
      }
    }
  }
};
export {
  GLOBAL_CHANNEL,
  JettChatWSClient,
  MatrixBridge,
  XActivityStream,
  boxDecrypt,
  boxEncrypt,
  completeHandshake,
  createDMChannel,
  createSession,
  decryptMessage,
  deriveConversationSeed,
  deriveMessageKey,
  deriveRootKey,
  deriveSharedSecret,
  displayName,
  encryptMessage,
  generateKeyPair,
  generateMessageId,
  nextMessageKey,
  resolveIdentityType,
  trefoilKnotParams
};
//# sourceMappingURL=index.mjs.map