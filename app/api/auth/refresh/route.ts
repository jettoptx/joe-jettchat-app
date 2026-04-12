import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshTokens } from "@jettoptx/auth";

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jettoptx.chat";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get("x_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const tokens = await refreshTokens(
      {
        clientId: X_CLIENT_ID,
        clientSecret: X_CLIENT_SECRET,
        redirectUri: `${APP_URL}/api/auth/x/callback`,
      },
      refreshToken
    );

    const response = NextResponse.json({ success: true });

    // Update refresh token if a new one is issued
    if (tokens.refresh_token) {
      response.cookies.set("x_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 86400,
        path: "/",
      });
    }

    console.log("✅ X tokens refreshed successfully");
    return response;
  } catch (err: any) {
    console.error("Token refresh failed:", err);
    return NextResponse.json(
      { error: "Refresh failed", detail: err.message },
      { status: 401 }
    );
  }
}
