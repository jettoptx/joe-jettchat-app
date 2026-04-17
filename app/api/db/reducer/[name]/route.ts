/**
 * POST /api/db/reducer/[name]
 *
 * Server-side proxy that forwards reducer calls to the SpacetimeDB jettchat
 * database on the Jetson (via Cloudflare Tunnel — never exposed to browser).
 *
 * Request body:  JSON array of positional reducer args, e.g. ["x123", "joshjett", "Joshua", "https://..."]
 * Response:      SpacetimeDB call response (typically empty 200 on success)
 *
 * The endpoint is read from the server-only env var SPACETIME_HTTP_URL.
 *
 * Allow-listed reducers only — every name a client can call must be enumerated
 * here. Anything else returns 403.
 */

import { NextRequest, NextResponse } from "next/server"

const SPACETIME_HTTP_URL = process.env.SPACETIME_HTTP_URL

// Reducers callable from the browser. Server-only / agent-only reducers
// (e.g. onchain_callback, x_outbox_*, sync_user_from_x when triggered by the
// JOE WS server) are intentionally excluded from this list.
const ALLOWED_REDUCERS = new Set<string>([
  // Phase 1 — user identity
  "sync_user_from_x",
  // Phase 2 — conversations & channels
  "create_conversation",
  "send_message_in_conversation",
  "create_channel",
  "join_channel",
  "request_message",
  "respond_message_request",
  // Existing community-room reducers
  "chat_send_message",
  "chat_send_encrypted",
])

export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const { name } = params

  if (!SPACETIME_HTTP_URL) {
    console.error("[db/reducer] SPACETIME_HTTP_URL is not set")
    return NextResponse.json(
      { error: "Database endpoint not configured" },
      { status: 503 }
    )
  }

  if (!ALLOWED_REDUCERS.has(name)) {
    return NextResponse.json(
      { error: `Reducer '${name}' is not allow-listed` },
      { status: 403 }
    )
  }

  let args: unknown
  try {
    args = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(args)) {
    return NextResponse.json(
      { error: "Reducer body must be a JSON array of positional args" },
      { status: 400 }
    )
  }

  const endpoint = `${SPACETIME_HTTP_URL.replace(/\/$/, "")}/call/${encodeURIComponent(name)}`

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "")
      console.error(`[db/reducer:${name}] Upstream ${upstream.status}: ${text}`)
      return NextResponse.json(
        { error: `Upstream SpacetimeDB error (${upstream.status})`, detail: text },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      )
    }

    // Reducer calls usually return empty body on success
    const text = await upstream.text()
    if (!text) return NextResponse.json({ ok: true })
    try {
      return NextResponse.json(JSON.parse(text))
    } catch {
      return NextResponse.json({ ok: true, raw: text })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[db/reducer:${name}] Fetch failed:`, message)
    return NextResponse.json(
      { error: `Failed to reach SpacetimeDB: ${message}` },
      { status: 502 }
    )
  }
}
