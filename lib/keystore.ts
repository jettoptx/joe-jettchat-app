"use client";

/**
 * keystore.ts — IndexedDB wrapper for X25519 key pairs
 *
 * Persists the local identity key pair across sessions.
 * Database: "jettchat-keys" / Object store: "keypairs"
 * Keys are stored as raw Uint8Array — never serialized to plaintext strings.
 */

const DB_NAME = "jettchat-keys";
const STORE_NAME = "keypairs";
const DB_VERSION = 1;
const KEY_ID = "identity";

export interface StoredKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getKeyPair(): Promise<StoredKeyPair | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY_ID);
    req.onsuccess = () => {
      if (!req.result) {
        resolve(null);
        return;
      }
      resolve({
        publicKey: new Uint8Array(req.result.publicKey),
        secretKey: new Uint8Array(req.result.secretKey),
      });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function storeKeyPair(
  publicKey: Uint8Array,
  secretKey: Uint8Array
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put({
      id: KEY_ID,
      // Store as plain Array so IDB can serialise without issues
      publicKey: Array.from(publicKey),
      secretKey: Array.from(secretKey),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Returns the existing key pair or generates and persists a new one.
 * Safe to call on every mount — idempotent.
 */
export async function getOrCreateKeyPair(): Promise<StoredKeyPair> {
  const existing = await getKeyPair();
  if (existing) return existing;

  // Lazy import so this module stays tree-shakeable in server components
  const nacl = (await import("tweetnacl")).default;
  const kp = nacl.box.keyPair();
  await storeKeyPair(kp.publicKey, kp.secretKey);
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}
