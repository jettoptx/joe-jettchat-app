/**
 * Zitadel auth routes DISABLED — VoiceJOE uses JettChat X OAuth now.
 * These routes existed for direct Zitadel OIDC login but are no longer needed.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Zitadel login disabled. Use /login for X OAuth." },
    { status: 410 }
  );
}
