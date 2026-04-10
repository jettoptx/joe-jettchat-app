import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// List messages in a conversation (paginated, ascending order)
export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(limit)
  },
})

// Send a message
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.optional(v.string()),
    content: v.string(),
    encryptedContent: v.optional(v.string()),
    nonce: v.optional(v.string()),
    senderPublicKey: v.optional(v.string()),
    messageType: v.string(),
    tensor: v.optional(v.string()),
    // X Community bridge
    source: v.optional(v.string()),
    xTweetId: v.optional(v.string()),
    relayToX: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const msgId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderName: args.senderName,
      senderAvatar: args.senderAvatar,
      content: args.content,
      encryptedContent: args.encryptedContent,
      nonce: args.nonce,
      senderPublicKey: args.senderPublicKey,
      messageType: args.messageType,
      tensor: args.tensor,
      source: args.source,
      xTweetId: args.xTweetId,
      relayToX: args.relayToX,
      createdAt: Date.now(),
    })

    // Update conversation preview
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
      lastMessagePreview:
        args.content.length > 60
          ? args.content.slice(0, 60) + "..."
          : args.content,
    })

    return msgId
  },
})

// List messages flagged for X relay that have not yet been posted (no xTweetId)
// Edge JOE polls this to pick up outbound relay work.
export const listPendingRelay = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    const candidates = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .take(500) // fetch a generous window then filter client-side
    return candidates
      .filter((m) => m.relayToX === true && !m.xTweetId)
      .slice(0, limit)
  },
})

// Mark a message as relayed to X by setting its tweet ID
export const markRelayed = mutation({
  args: {
    messageId: v.id("messages"),
    xTweetId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { xTweetId: args.xTweetId })
    return args.messageId
  },
})
