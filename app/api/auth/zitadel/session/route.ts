/**
 * Zitadel session DISABLED — VoiceJOE uses JettChat X OAuth now.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ authenticated: false, error: "Zitadel disabled" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ ok: true });
}
