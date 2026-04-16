import { ConvexReactClient } from "convex/react"

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL
if (!CONVEX_URL) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set — check .env.local")

export const convex = new ConvexReactClient(CONVEX_URL)
