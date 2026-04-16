/**
 * Zitadel callback DISABLED — VoiceJOE uses JettChat X OAuth now.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
