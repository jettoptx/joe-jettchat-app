import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Store a new attestation batch in "pending" state.
// Called by Edge JOE after computing the Merkle root for a message batch,
// before the Solana transaction has been submitted.
export const create = mutation({
  args: {
    channelSlug: v.string(),
    merkleRoot: v.string(),
    messageHashes: v.array(v.string()),
    messageCount: v.number(),
    batchIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("attestations", {
      channelSlug: args.channelSlug,
      merkleRoot: args.merkleRoot,
      messageHashes: args.messageHashes,
      messageCount: args.messageCount,
      batchIndex: args.batchIndex,
      status: "pending",
      createdAt: Date.now(),
    })
    return id
  },
})

// Update an attestation with the on-chain Solana tx signature and mark confirmed (or failed).
// Also patches the channel's lastAttestationTx for quick reads.
export const confirm = mutation({
  args: {
    attestationId: v.id("attestations"),
    txSignature: v.string(),
    status: v.string(), // "confirmed" | "failed"
  },
  handler: async (ctx, args) => {
    const attestation = await ctx.db.get(args.attestationId)
    if (!attestation) throw new Error("Attestation not found")

    await ctx.db.patch(args.attestationId, {
      txSignature: args.txSignature,
      status: args.status,
    })

    // Keep the channel's lastAttestationTx fresh when confirmed
    if (args.status === "confirmed") {
      const channel = await ctx.db
        .query("channels")
        .withIndex("by_slug", (q) => q.eq("slug", attestation.channelSlug))
        .first()
      if (channel) {
        await ctx.db.patch(channel._id, {
          lastAttestationTx: args.txSignature,
        })
      }
    }

    return args.attestationId
  },
})

// Return all attestations for a channel ordered by batchIndex ascending.
export const listByChannel = query({
  args: {
    channelSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    return await ctx.db
      .query("attestations")
      .withIndex("by_channel", (q) => q.eq("channelSlug", args.channelSlug))
      .order("asc")
      .take(limit)
  },
})

// Return the most recent attestation for a channel (highest batchIndex).
export const getLatest = query({
  args: {
    channelSlug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attestations")
      .withIndex("by_channel", (q) => q.eq("channelSlug", args.channelSlug))
      .order("desc")
      .first()
  },
})
