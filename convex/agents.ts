import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const upsert = mutation({
  args: {
    xHandle: v.string(),
    solanaWallet: v.string(),
    agentType: v.string(),
    publicKey: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    x402Policy: v.optional(v.object({
      maxPerRequest: v.optional(v.number()),
      currency: v.optional(v.string()),
      enabled: v.boolean(),
    })),
    erc8002Score: v.optional(v.number()),
    erc8002Registry: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_xHandle", (q) => q.eq("xHandle", args.xHandle))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      })
      return existing._id
    }

    return await ctx.db.insert("agents", {
      ...args,
      createdAt: Date.now(),
      isActive: true,
    })
  },
})

export const getByHandle = query({
  args: { xHandle: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_xHandle", (q) => q.eq("xHandle", args.xHandle))
      .first()
  },
})

export const listActive = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("agents").take(100)
    return all.filter((a) => a.isActive)
  },
})

export const listByOwner = query({
  args: { ownerXId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_owner", (q) => q.eq("ownerXId", args.ownerXId))
      .take(50)
  },
})
