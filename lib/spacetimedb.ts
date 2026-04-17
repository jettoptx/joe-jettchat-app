/**
 * lib/spacetimedb.ts
 *
 * Typed HTTP client for the SpacetimeDB jettchat module.
 * All SQL queries are routed through the server-side proxy at /api/db/sql
 * so the Tailscale endpoint is never exposed to the browser.
 *
 * SpacetimeDB SQL limitations:
 *   - NO ORDER BY
 *   - NO LIKE  (filter client-side)
 *   - NO subqueries in WHERE
 */

// ---------------------------------------------------------------------------
// Row types matching the jtx_* tables
// ---------------------------------------------------------------------------

export interface JtxUser {
  id: string
  created_at: string
  updated_at: string | null
  zitadel_sub: string | null
  zitadel_iss: string | null
  username: string
  display_name: string | null
  avatar_url: string | null
  solana_wallet: string | null
  e_2_e_public_key: string | null
  x_id: string | null
  x_handle: string | null
  x_access_token_enc: string | null
  x_refresh_token_enc: string | null
  x_token_expires_at: string | null
  gaze_tensor_hash: string | null
  gaze_enrolled: boolean
  subscription_tier: string | null
  is_active: boolean
  last_seen_at: string | null
}

export interface JtxAgent {
  id: string
  created_at: string
  updated_at: string | null
  x_handle: string
  solana_wallet: string | null
  public_key: string | null
  agent_type: string
  owner_x_id: string | null
  status: string | null
  capabilities: string | null  // JSON array stored as text in SpacetimeDB
  last_seen_at: string | null
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  erc8002_score: number | null
  erc8002_registry: string | null
  x402_policy: string | null   // JSON object stored as text
}

export interface JtxMessage {
  id: string
  created_at: string
  sender_id: string
  sender_name: string
  sender_avatar: string | null
  sender_type: string
  content: string
  encrypted_content: string | null
  nonce: string | null
  sender_public_key: string | null
  message_type: string
  tensor: string | null
  source: string | null
  x_tweet_id: string | null
  relay_to_x: boolean
  reply_to_id: string | null
  conversation_id: string | null
  attestation_root: string | null
  attestation_tx: string | null
}

export interface JtxConversation {
  id: string
  created_at: string
  updated_at: string | null
  conversation_type: string          // "dm" | "group" | "channel"
  participants_csv: string           // comma-separated x_id list
  is_encrypted: boolean
  name: string | null
  slug: string | null
  last_message_at: string | null
  last_message_preview: string | null
  created_by: string
}

export interface JtxChannel {
  id: string
  created_at: string
  slug: string                       // "$jettchat" | "#dojo" | "#mojo"
  name: string
  description: string | null
  channel_type: string               // "public" | "gated" | "private"
  gate_requirement: string | null
  members_csv: string
  conversation_id: string | null
  x_community_id: string | null
  on_chain_attestation: boolean
  last_attestation_tx: string | null
  created_by: string
}

export interface JtxVoiceSession {
  id: string
  created_at: string
  updated_at: string | null
  user_id: string
  agent_id: string | null
  status: string
  duration_ms: number | null
  transcript: string | null
}

// ---------------------------------------------------------------------------
// Core query function
// ---------------------------------------------------------------------------

/**
 * Execute a SQL query against the SpacetimeDB jettchat database.
 * Routes through the /api/db/sql Next.js proxy so the Tailscale IP
 * is never visible to the browser.
 */
export async function sqlQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const res = await fetch("/api/db/sql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`SpacetimeDB query failed (${res.status}): ${text}`)
  }

  const data = await res.json()

  // SpacetimeDB HTTP SQL API returns:
  //   { rows: [...], columns: [...] }   (v2 response format)
  //   or an array of row objects        (simplified proxy format)
  if (Array.isArray(data)) {
    return data as T[]
  }
  if (data && Array.isArray(data.rows)) {
    // Map column-array rows into objects
    const cols: string[] = data.columns ?? []
    return (data.rows as unknown[][]).map((row) => {
      const obj: Record<string, unknown> = {}
      cols.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj as T
    })
  }
  return []
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a jtx_user row by X handle.
 * SpacetimeDB has no LIKE — exact match only.
 */
export async function getUserByXHandle(
  handle: string
): Promise<JtxUser | null> {
  const rows = await sqlQuery<JtxUser>(
    `SELECT * FROM jtx_user WHERE x_handle = '${handle.replace(/'/g, "''")}' LIMIT 1`
  )
  return rows[0] ?? null
}

/**
 * Fetch a jtx_user row by Zitadel subject (sub claim).
 */
export async function getUserByZitadelSub(
  sub: string
): Promise<JtxUser | null> {
  const rows = await sqlQuery<JtxUser>(
    `SELECT * FROM jtx_user WHERE zitadel_sub = '${sub.replace(/'/g, "''")}' LIMIT 1`
  )
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Agent helpers
// ---------------------------------------------------------------------------

/**
 * List all active agents.
 * Note: SpacetimeDB has no ORDER BY — sort client-side if needed.
 */
export async function listAgents(): Promise<JtxAgent[]> {
  const rows = await sqlQuery<JtxAgent>(
    `SELECT * FROM jtx_agent WHERE is_active = true`
  )
  // Sort by created_at descending client-side
  return rows.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
}

/**
 * Fetch a single agent by X handle.
 */
export async function getAgent(xHandle: string): Promise<JtxAgent | null> {
  const rows = await sqlQuery<JtxAgent>(
    `SELECT * FROM jtx_agent WHERE x_handle = '${xHandle.replace(/'/g, "''")}' LIMIT 1`
  )
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Voice session helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Conversation helpers (Phase 2)
// ---------------------------------------------------------------------------

/**
 * List conversations that a given xId participates in.
 * SpacetimeDB has no LIKE — we fetch all and filter the CSV column client-side.
 */
export async function listConversationsForUser(
  xId: string
): Promise<JtxConversation[]> {
  if (!xId) return []
  const rows = await sqlQuery<JtxConversation>(`SELECT * FROM jtx_conversation`)
  return rows
    .filter((c) => c.participants_csv.split(",").map((s) => s.trim()).includes(xId))
    .sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return tb - ta
    })
}

/** Fetch a single conversation by id. */
export async function getConversation(
  id: string
): Promise<JtxConversation | null> {
  const rows = await sqlQuery<JtxConversation>(
    `SELECT * FROM jtx_conversation WHERE id = ${Number(id) || 0}`
  )
  return rows[0] ?? null
}

/** List all channels (public listing — gating enforced server-side at message-send). */
export async function listChannels(): Promise<JtxChannel[]> {
  const rows = await sqlQuery<JtxChannel>(`SELECT * FROM jtx_channel`)
  return rows.sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    return ta - tb
  })
}

/**
 * List messages in a conversation (or community room when conversationId === "0").
 * SpacetimeDB has no ORDER BY — we sort client-side, then take the most recent `limit`.
 */
export async function listMessagesByConversation(
  conversationId: string,
  limit = 100
): Promise<JtxMessage[]> {
  const cid = Number(conversationId) || 0
  const rows = await sqlQuery<JtxMessage>(
    `SELECT * FROM jtx_message WHERE conversation_id = ${cid}`
  )
  rows.sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    return ta - tb
  })
  return rows.slice(-limit)
}

// ---------------------------------------------------------------------------
// Reducer caller
// ---------------------------------------------------------------------------

/**
 * Call a SpacetimeDB reducer through the /api/db/reducer/[name] proxy.
 * Args are passed positionally as a JSON array — order MUST match the
 * reducer signature in jettchat-module/src/lib.rs.
 */
export async function callReducer(
  name: string,
  args: unknown[]
): Promise<void> {
  const res = await fetch(`/api/db/reducer/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Reducer '${name}' failed (${res.status}): ${text}`)
  }
}

/** Convenience wrapper for `send_message_in_conversation`. */
export async function sendMessageInConversation(input: {
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  encryptedContent?: string
  nonce?: string
  senderPublicKey?: string
  messageType?: string
  tensor?: string
  relayToX?: boolean
  replyToId?: string
}): Promise<void> {
  await callReducer("send_message_in_conversation", [
    Number(input.conversationId) || 0,
    input.senderId,
    input.senderName,
    input.senderAvatar ?? "",
    input.content,
    input.encryptedContent ?? "",
    input.nonce ?? "",
    input.senderPublicKey ?? "",
    input.messageType ?? "chat",
    input.tensor ?? "",
    input.relayToX ?? false,
    Number(input.replyToId) || 0,
  ])
}

/**
 * List voice sessions for a given user ID.
 */
export async function listVoiceSessions(
  userId: string
): Promise<JtxVoiceSession[]> {
  const rows = await sqlQuery<JtxVoiceSession>(
    `SELECT * FROM jtx_voice_session WHERE user_id = '${userId.replace(/'/g, "''")}'`
  )
  // Sort by created_at descending client-side
  return rows.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
}
