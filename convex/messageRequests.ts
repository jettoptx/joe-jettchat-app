import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// List pending requests for a user
export const listPending = query({
  args: { toUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messageRequests")
      .withIndex("by_recipient", (q) =>
        q.eq("toUserId", args.toUserId).eq("status", "pending")
      )
      .collect()
  },
})

// Create a message request
export const create = mutation({
  args: {
    fromUserId: v.string(),
    toUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if request already exists
    const existing = await ctx.db
      .query("messageRequests")
      .withIndex("by_sender", (q) => q.eq("fromUserId", args.fromUserId))
      .collect()

    const match = existing.find(
      (r) => r.toUserId === args.toUserId && r.status === "pending"
    )
    if (match) return match._id

    return await ctx.db.insert("messageRequests", {
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      status: "pending",
      createdAt: Date.now(),
    })
  },
})

// Accept a message request — creates conversation
export const accept = mutation({
  args: { requestId: v.id("messageRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId)
    if (!request) throw new Error("Request not found")
    if (request.status !== "pending") throw new Error("Request already processed")

    // Create conversation
    const conversationId = await ctx.db.insert("conversations", {
      type: "dm",
      participants: [request.fromUserId, request.toUserId],
      isEncrypted: true,
      createdAt: Date.now(),
      createdBy: request.fromUserId,
    })

    // Update request
    await ctx.db.patch(args.requestId, {
      status: "accepted",
      conversationId,
      respondedAt: Date.now(),
    })

    return conversationId
  },
})

// Decline a message request
export const decline = mutation({
  args: { requestId: v.id("messageRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      status: "declined",
      respondedAt: Date.now(),
    })
  },
})
