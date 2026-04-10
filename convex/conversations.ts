import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// List conversations for a user (by xId in participants array)
export const listForUser = query({
  args: { xId: v.string() },
  handler: async (ctx, args) => {
    // Get all conversations and filter by participant
    // Convex doesn't support array-contains index, so we filter client-side
    const all = await ctx.db
      .query("conversations")
      .withIndex("by_lastMessage")
      .order("desc")
      .take(100)

    return all.filter((c) => c.participants.includes(args.xId))
  },
})

// Get a single conversation
export const getById = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Create a new DM conversation
export const create = mutation({
  args: {
    type: v.string(),
    participants: v.array(v.string()),
    isEncrypted: v.boolean(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if DM conversation already exists between these participants
    if (args.type === "dm" && args.participants.length === 2) {
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_createdAt")
        .order("desc")
        .take(200)

      const match = existing.find(
        (c) =>
          c.type === "dm" &&
          c.participants.length === 2 &&
          args.participants.every((p) => c.participants.includes(p))
      )

      if (match) return match._id
    }

    return await ctx.db.insert("conversations", {
      type: args.type,
      participants: args.participants,
      isEncrypted: args.isEncrypted,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    })
  },
})

// Update conversation with latest message preview
export const updateLastMessage = mutation({
  args: {
    id: v.id("conversations"),
    preview: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastMessageAt: Date.now(),
      lastMessagePreview: args.preview,
    })
  },
})
