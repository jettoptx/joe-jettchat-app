/**
 * GET /api/auth/session — Verify JWT and return session data
 *
 * Reads jettauth (Ed25519 JWT) + x_profile cookies.
 * No Convex sync — user data lives in SpacetimeDB.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@jettoptx/auth";

function b64Decode(str?: string): Uint8Array {
  if (!str) throw new Error("JWT_PUBLIC_KEY environment variable is not set");
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get("jettauth")?.value;
  const xProfileCookie = cookieStore.get("x_profile")?.value;

  if (!token) {
    return NextResponse.json({ isSignedIn: false, isLoaded: true });
  }

  if (!JWT_PUBLIC_KEY) {
    console.error("JWT_PUBLIC_KEY not configured for session verification");
    return NextResponse.json(
      { isSignedIn: false, isLoaded: true, error: "server_config" },
      { status: 500 }
    );
  }

  try {
    const publicKey = b64Decode(JWT_PUBLIC_KEY);
    const claims = verifyJWT(token, publicKey);

    let xProfile = null;
    if (xProfileCookie) {
      try {
        xProfile = JSON.parse(xProfileCookie);
      } catch {
        console.warn("Failed to parse x_profile cookie");
      }
    }

    return NextResponse.json({
      isLoaded: true,
      isSignedIn: true,
      claims,
      xProfile,
      walletPubkey: claims.sub?.replace("sol:", "") ?? null,
    });
  } catch (err: any) {
    console.error("Session verification failed:", err);
    return NextResponse.json({
      isLoaded: true,
      isSignedIn: false,
      error: err.message || "invalid_token",
    });
  }
}
