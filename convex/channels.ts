import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("channels").collect()
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channels")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()
  },
})

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    gateRequirement: v.optional(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()

    if (existing) throw new Error(`Channel ${args.slug} already exists`)

    // Create backing conversation
    const conversationId = await ctx.db.insert("conversations", {
      type: "channel",
      participants: [args.createdBy],
      isEncrypted: false,
      name: args.name,
      slug: args.slug,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    })

    return await ctx.db.insert("channels", {
      slug: args.slug,
      name: args.name,
      description: args.description,
      type: args.type,
      gateRequirement: args.gateRequirement,
      members: [args.createdBy],
      conversationId,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    })
  },
})

export const join = mutation({
  args: {
    slug: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first()

    if (!channel) throw new Error("Channel not found")
    if (channel.members.includes(args.userId)) return channel._id

    await ctx.db.patch(channel._id, {
      members: [...channel.members, args.userId],
    })

    // Also add to conversation participants
    if (channel.conversationId) {
      const conv = await ctx.db.get(channel.conversationId)
      if (conv && !conv.participants.includes(args.userId)) {
        await ctx.db.patch(channel.conversationId, {
          participants: [...conv.participants, args.userId],
        })
      }
    }

    return channel._id
  },
})
