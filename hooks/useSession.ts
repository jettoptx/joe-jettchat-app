"use client";

/**
 * useSession.ts — Reads the X OAuth session from cookies
 *
 * The X OAuth callback sets `x_profile` (client-readable) and `jettauth` (httpOnly JWT).
 * This hook parses the x_profile cookie to provide user identity to components.
 */

import { useState, useEffect } from "react";

export interface XSession {
  xId: string;
  username: string;
  name: string;
  avatar?: string;
  verified: boolean;
}

function parseCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function useSession(): {
  session: XSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const [session, setSession] = useState<XSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const raw = parseCookie("x_profile");
    if (raw) {
      try {
        const profile = JSON.parse(raw);
        setSession({
          xId: profile.id,
          username: profile.username,
          name: profile.name,
          avatar: profile.avatar,
          verified: profile.verified ?? false,
        });
      } catch {
        setSession(null);
      }
    }
    setIsLoading(false);
  }, []);

  return {
    session,
    isAuthenticated: session !== null,
    isLoading,
  };
}
