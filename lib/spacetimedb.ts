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
  attestation_root: string | null
  attestation_tx: string | null
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
