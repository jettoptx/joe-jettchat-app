"use client"

/**
 * SpacetimeUserSync
 *
 * Replaces ConvexUserSync. On X OAuth login, upserts the authenticated user
 * into the jtx_user table via the SpacetimeDB reducer `sync_user_from_x`.
 *
 * Reducer call: POST /api/db/reducer/sync_user_from_x
 * Body: positional args [x_id, x_handle, display_name, avatar_url]
 *
 * The reducer is deployed in jettchat-module/src/lib.rs (line ~1918) and
 * upserts by x_id — creating a new jtx_user row or refreshing display_name,
 * avatar_url, and last_seen_at on an existing one.
 */

import { useEffect } from "react"
import { useAuth } from "@jettoptx/auth/next"
import { useSearchParams } from "next/navigation"

async function callReducer(reducerName: string, args: unknown[]): Promise<void> {
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

      // Positional args matching `sync_user_from_x(x_id, x_handle, display_name, avatar_url)`
      const args: [string, string, string, string] = [
        xProfile.id,
        xProfile.username,
        xProfile.name ?? xProfile.username,
        xProfile.profile_image_url ?? "",
      ]

      try {
        await callReducer("sync_user_from_x", args)
        console.log("[SpacetimeUserSync] jtx_user synced for x:", xProfile.username)

        // Clean up the sync param from the URL
        const url = new URL(window.location.href)
        url.searchParams.delete("sync")
        window.history.replaceState({}, "", url.toString())
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[SpacetimeUserSync] Failed to sync user:", msg)
      }
    }

    syncUser()
  }, [isLoaded, isSignedIn, xProfile, shouldSync])

  return null
}
