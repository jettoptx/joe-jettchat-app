import { NextResponse } from "next/server";
import { generatePKCE, buildAuthorizeUrl } from "@jettoptx/auth";

const X_CLIENT_ID = process.env.X_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333";

export async function GET() {
  const pkce = generatePKCE();

  const authorizeUrl = buildAuthorizeUrl(
    {
      clientId: X_CLIENT_ID,
      redirectUri: `${APP_URL}/api/auth/x/callback`,
      // Read + Write so JOE can eventually post, like, reply, etc.
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    },
    pkce
  );

  // Set cookie on the redirect response directly — cookies().set() from
  // next/headers does NOT attach to NextResponse.redirect() in App Router.
  const response = NextResponse.redirect(authorizeUrl);
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set("x_oauth_state", JSON.stringify({
    codeVerifier: pkce.codeVerifier,
    state: pkce.state,
  }), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
    // Allow cookie to be read across www and non-www subdomains
    ...(isProduction ? { domain: ".jettoptx.chat" } : {}),
  });

  return response;
}
