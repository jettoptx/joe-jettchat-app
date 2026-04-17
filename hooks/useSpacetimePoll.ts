"use client"

import { useEffect, useRef, useState, useCallback } from "react"

/**
 * useSpacetimePoll
 *
 * Lightweight polling hook for SpacetimeDB HTTP queries — gives us
 * "real-time-ish" updates without a WebSocket subscription. Use until a
 * proper subscription channel is wired up.
 *
 *   - Runs `fetcher` immediately on mount and re-runs on dep change.
 *   - After the first successful run, refetches every `intervalMs` ms
 *     while the tab is visible. Pauses when the tab is hidden, refetches
 *     once on visibility return.
 *   - `enabled = false` short-circuits — useful while auth is still loading.
 *
 * Returns { data, error, loading, refetch }.
 */
export function useSpacetimePoll<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: { intervalMs?: number; enabled?: boolean } = {}
): {
  data: T | undefined
  error: string | null
  loading: boolean
  refetch: () => Promise<void>
} {
  const { intervalMs = 4000, enabled = true } = options
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(enabled)
  const cancelledRef = useRef(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const run = useCallback(async () => {
    try {
      const next = await fetcherRef.current()
      if (!cancelledRef.current) {
        setData(next)
        setError(null)
      }
    } catch (err: unknown) {
      if (!cancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      }
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    cancelledRef.current = false
    setLoading(true)
    void run()

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void run()
    }

    const interval = window.setInterval(tick, intervalMs)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelledRef.current = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, ...deps])

  return { data, error, loading, refetch: run }
}
