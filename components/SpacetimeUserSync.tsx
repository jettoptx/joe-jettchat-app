"use client"

/**
 * SpacetimeUserSync
 *
 * Replaces ConvexUserSync. On auth, upserts the authenticated user
 * into the jtx_user table via the SpacetimeDB reducer `upsert_user`.
 *
 * Reducer call: POST /v1/database/jettchat/call/upsert_user
 * (proxied through /api/db/reducer on the Next.js server — see Phase 2)
 *
 * Phase 1 status:
 *   The upsert_user reducer does NOT yet exist in jettchat-module/src/lib.rs.
 *   This component calls it optimistically and logs a clear error when it 404s,
 *   so the app remains functional while Phase 2 module work is pending.
 *   See MIGRATION_NOTES.md for the required reducer signature.
 */

import { useEffect } from "react"
import { useAuth } from "@jettoptx/auth/next"
import { useSearchParams } from "next/navigation"

interface UpsertUserPayload {
  x_id: string
  x_handle: string
  display_name: string
  avatar_url: string
  verified?: boolean
}

async function callReducer(reducerName: string, args: unknown): Promise<void> {
  const res = await fetch(`/api/db/reducer/${reducerName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Reducer '${reducerName}' failed (${res.status}): ${text}`)
  }
}

export function SpacetimeUserSync() {
  const { isSignedIn, xProfile, isLoaded } = useAuth()
  const searchParams = useSearchParams()
  const shouldSync = searchParams.get("sync") === "true"

  useEffect(() => {
    const syncUser = async () => {
      if (!isLoaded || !isSignedIn || !xProfile?.id || !shouldSync) return

      const payload: UpsertUserPayload = {
        x_id: xProfile.id,
        x_handle: xProfile.username,
        display_name: xProfile.name ?? xProfile.username,
        avatar_url: xProfile.profile_image_url ?? "",
        verified: xProfile.verified,
      }

      try {
        await callReducer("upsert_user", payload)
        console.log("[SpacetimeUserSync] jtx_user upserted for x:", xProfile.username)

        // Clean up the sync param from the URL
        const url = new URL(window.location.href)
        url.searchParams.delete("sync")
        window.history.replaceState({}, "", url.toString())
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("404") || msg.includes("not configured")) {
          // Expected during Phase 1 — reducer not yet in jettchat-module
          console.warn(
            "[SpacetimeUserSync] upsert_user reducer not yet deployed (Phase 2 pending).",
            "Add it to jettchat-module/src/lib.rs — see MIGRATION_NOTES.md"
          )
        } else {
          console.error("[SpacetimeUserSync] Failed to sync user:", msg)
        }
      }
    }

    syncUser()
  }, [isLoaded, isSignedIn, xProfile, shouldSync])

  return null
}
