import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@jettoptx/auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Base64 decode helper (shared with callback)
function b64Decode(str?: string): Uint8Array {
  if (!str) {
    throw new Error("JWT_PUBLIC_KEY environment variable is not set");
  }
  const bin = Buffer.from(str, "base64");
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jettoptx.chat";

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
      } catch (e) {
        console.warn("Failed to parse x_profile cookie");
      }
    }

    // Server-side Convex user sync (stronger guarantee than client-only)
    if (xProfile?.id) {
      try {
        const convexClient = new ConvexHttpClient(
          process.env.NEXT_PUBLIC_CONVEX_URL!
        );
        await convexClient.mutation(api.users.upsertFromXOAuth, {
          xId: xProfile.id,
          username: xProfile.username,
          displayName: xProfile.name || xProfile.username,
          avatarUrl: xProfile.avatar,
          verified: !!xProfile.verified,
        });
        console.log(`✅ Server-side Convex user synced for x:${xProfile.id}`);
      } catch (syncErr) {
        console.warn("Server-side Convex sync failed (non-blocking):", syncErr);
        // Client-side sync will still run as fallback
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
