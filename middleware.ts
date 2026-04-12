import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/callback",
  "/pricing",
  "/api/auth",
  "/api/jtx-check",
];

// Routes that require 1 JTX (or Stripe purchase) to access
const GATED_ROUTES = [
  "/chat",
  "/agents",
  "/notifications",
  "/search",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes + API routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for JWT cookie (X OAuth session)
  const token = request.cookies.get("jettauth")?.value;

  // Check for JTX gate pass (set after wallet verification or Stripe purchase)
  const jtxGatePass = request.cookies.get("jtx_gate")?.value;

  // No auth at all → redirect to login
  if (!token && !jtxGatePass) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Gated routes require JTX gate pass OR valid jettauth token
  // During devnet test phase: jettauth alone is sufficient for chat access
  if (GATED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!jtxGatePass && !token) {
      // User has neither auth method — redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("gate", "required");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.gif$).*)"],
};
