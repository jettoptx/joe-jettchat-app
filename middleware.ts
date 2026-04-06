import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/callback",
  "/pricing",
  "/api/auth",
  "/voice", // Voice page is full-screen, no sidebar
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for JWT cookie
  const token = request.cookies.get("jettauth")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // TODO: Verify JWT signature server-side (requires publicKey in env)
  // For now, presence of cookie is sufficient for routing
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
