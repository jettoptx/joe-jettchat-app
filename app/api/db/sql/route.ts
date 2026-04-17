/**
 * POST /api/db/sql
 *
 * Server-side proxy that forwards SQL queries to the SpacetimeDB jettchat
 * database on the Jetson Orin Nano (Tailscale mesh — never exposed to browser).
 *
 * Request body:  { sql: string }
 * Response:      SpacetimeDB HTTP SQL response (rows + columns, or array)
 *
 * The Tailscale endpoint is read from the server-only env var SPACETIME_HTTP_URL.
 * NEXT_PUBLIC_* variants are intentionally NOT used here.
 */

import { NextRequest, NextResponse } from "next/server"

const SPACETIME_HTTP_URL = process.env.SPACETIME_HTTP_URL

export async function POST(request: NextRequest) {
  if (!SPACETIME_HTTP_URL) {
    console.error("[db/sql] SPACETIME_HTTP_URL is not set")
    return NextResponse.json(
      { error: "Database endpoint not configured" },
      { status: 503 }
    )
  }

  let body: { sql?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { sql } = body
  if (!sql || typeof sql !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'sql' field" },
      { status: 400 }
    )
  }

  // Block obviously destructive statements — the jettchat module handles
  // all mutations through reducers, never raw SQL writes.
  const trimmed = sql.trim().toUpperCase()
  if (
    trimmed.startsWith("INSERT") ||
    trimmed.startsWith("UPDATE") ||
    trimmed.startsWith("DELETE") ||
    trimmed.startsWith("DROP") ||
    trimmed.startsWith("ALTER") ||
    trimmed.startsWith("CREATE")
  ) {
    return NextResponse.json(
      { error: "Write operations must use SpacetimeDB reducers, not raw SQL" },
      { status: 403 }
    )
  }

  const endpoint = `${SPACETIME_HTTP_URL.replace(/\/$/, "")}/sql`

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: sql,
    })

    const contentType = upstream.headers.get("content-type") ?? ""
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "")
      console.error(`[db/sql] Upstream error ${upstream.status}: ${text}`)
      return NextResponse.json(
        { error: `Upstream SpacetimeDB error (${upstream.status})` },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      )
    }

    // SpacetimeDB returns JSON — pass it straight through
    if (contentType.includes("application/json")) {
      const json = await upstream.json()
      return NextResponse.json(json)
    }

    // Fallback: return raw text wrapped in an object
    const text = await upstream.text()
    return NextResponse.json({ raw: text })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[db/sql] Fetch failed:", message)
    return NextResponse.json(
      { error: `Failed to reach SpacetimeDB: ${message}` },
      { status: 502 }
    )
  }
}
