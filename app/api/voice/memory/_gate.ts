/**
 * Shared founder-gate helper for /api/voice/memory/* endpoints.
 *
 * Mirrors /api/voice/token/route.ts: fail-closed Ed25519 verification,
 * pin on immutable X user ID from ALLOWED_X_IDS, handle check as
 * secondary signal. No decode-only fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@jettoptx/auth";

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;

const ALLOWED_X_IDS = new Set(
  (process.env.ALLOWED_X_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
const ALLOWED_HANDLES = new Set(
  (process.env.ALLOWED_X_HANDLES || "jettoptx")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function b64Decode(str: string): Uint8Array {
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

/**
 * Returns null on success (allowed). Returns a NextResponse with the
 * appropriate error status on failure.
 */
export function checkFounderGate(request: NextRequest): NextResponse | null {
  if (!JWT_PUBLIC_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured: signing key missing" },
      { status: 503 }
    );
  }
  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 });
  }
  try {
    const publicKey = b64Decode(JWT_PUBLIC_KEY);
    const claims = verifyJWT(jwt, publicKey) as unknown as Record<string, unknown>;

    const xId = String(claims.xId ?? claims.x_id ?? "");
    const xHandle = String(claims.xHandle ?? claims.x_handle ?? "").toLowerCase();
    const exp = typeof claims.exp === "number" ? claims.exp : undefined;

    if (exp !== undefined && Date.now() / 1000 > exp) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    if (!xId || !xHandle) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const idOk = ALLOWED_X_IDS.size === 0 || ALLOWED_X_IDS.has(xId);
    const handleOk = ALLOWED_HANDLES.has(xHandle);

    if (!idOk || !handleOk) {
      return NextResponse.json(
        { error: "Forbidden: founder account only" },
        { status: 403 }
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — invalid session" },
      { status: 401 }
    );
  }
}

/**
 * SpacetimeDB jettchat HTTP SQL endpoint (public via Cloudflare Tunnel).
 * Safe for read-only SELECT queries. Write operations should go through
 * HEDGEHOG `/memory/store`, not this proxy.
 */
export const STDB_URL =
  process.env.STDB_URL || "https://stdb.jettoptics.ai/v1/database/jettchat/sql";

/**
 * Parse SpacetimeDB SQL response (an array of table results each containing
 * `schema` + `rows`) into a simple array of objects keyed by column name.
 */
export function parseStdbRows(resp: any): Record<string, unknown>[] {
  if (!Array.isArray(resp) || resp.length === 0) return [];
  const { schema, rows } = resp[0] || {};
  const cols = (schema?.elements || []).map((e: any) => e?.name?.some || e?.name);
  if (!Array.isArray(rows)) return [];
  return rows.map((r: unknown[]) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = r[i];
    return obj;
  });
}

export function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}
