/**
 * GET  /api/x/dms/[id] — Fetch a DM thread by conversation ID.
 * POST /api/x/dms/[id] — Send a message into a DM conversation.
 *
 * STUB — returns 501 until wired to @xdevplatform/xdk or the xmcp server on
 * the Jetson (port 8888). JWT gate mirrors the pattern used in /api/voice/token.
 */

import { NextRequest, NextResponse } from "next/server";

const NOT_IMPLEMENTED = {
  error: "not_implemented",
  note: "wire to xmcp on Jetson or @xdevplatform/xdk in next PR",
} as const;

export async function GET(request: NextRequest) {
  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 });
  }

  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}

export async function POST(request: NextRequest) {
  const jwt = request.cookies.get("jettauth")?.value;
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 });
  }

  return NextResponse.json(NOT_IMPLEMENTED, { status: 501 });
}
