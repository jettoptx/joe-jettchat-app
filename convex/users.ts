import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Upsert user from X OAuth profile data
export const upsertFromXOAuth = mutation({
  args: {
    xId: v.string(),
    username: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    solanaWallet: v.optional(v.string()),
    publicKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_xId", (q) => q.eq("xId", args.xId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        username: args.username,
        displayName: args.displayName,
        avatarUrl: args.avatarUrl,
        verified: args.verified,
        solanaWallet: args.solanaWallet ?? existing.solanaWallet,
        publicKey: args.publicKey ?? existing.publicKey,
        updatedAt: Date.now(),
        lastSeenAt: Date.now(),
        isActive: true,
      })
      return existing._id
    }

    return await ctx.db.insert("users", {
      xId: args.xId,
      username: args.username,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      verified: args.verified,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      isActive: true,
      solanaWallet: args.solanaWallet,
      publicKey: args.publicKey,
    })
  },
})

// Get user by X ID
export const getByXId = query({
  args: { xId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_xId", (q) => q.eq("xId", args.xId))
      .first()
  },
})

// Get user by username
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first()
  },
})

// Update user's public key (for E2E key exchange)
export const updatePublicKey = mutation({
  args: {
    xId: v.string(),
    publicKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_xId", (q) => q.eq("xId", args.xId))
      .first()

    if (!user) throw new Error("User not found")

    await ctx.db.patch(user._id, {
      publicKey: args.publicKey,
      updatedAt: Date.now(),
    })
  },
})
