import { mutation } from "./_generated/server"
import { v } from "convex/values"

// Seed default channels — run once via Convex dashboard or CLI
export const seed = mutation({
  handler: async (ctx) => {
    const defaults = [
      {
        slug: "#space-cowboys",
        name: "Space Cowboys",
        description: "Welcome to JettChat — the Space Cowboys public channel. Introduce yourself and get started.",
        type: "public" as const,
        gateRequirement: undefined,
        xCommunityId: undefined,
        onChainAttestation: undefined,
      },
      {
        slug: "$JTX",
        name: "Space Cowboys",
        description: "Global encrypted chat — gated by Space Cowboys X Community membership",
        type: "public" as const,
        gateRequirement: undefined,
        xCommunityId: "1721586215403786447",
        onChainAttestation: undefined,
      },
      {
        slug: "#mojo",
        name: "MOJO",
        description: "MOJO tier — 12 JTX stake or $8.88/mo subscription",
        type: "gated" as const,
        gateRequirement: "JTX:12",
        xCommunityId: undefined,
        onChainAttestation: true,
      },
      {
        slug: "#dojo",
        name: "DOJO",
        description: "DOJO tier — 444 JTX stake or $28.88/6mo subscription",
        type: "gated" as const,
        gateRequirement: "JTX:444",
        xCommunityId: undefined,
        onChainAttestation: true,
      },
    ]

    for (const ch of defaults) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_slug", (q) => q.eq("slug", ch.slug))
        .first()

      if (existing) continue

      // Create backing conversation
      const conversationId = await ctx.db.insert("conversations", {
        type: "channel",
        participants: [],
        isEncrypted: false,
        name: ch.name,
        slug: ch.slug,
        createdAt: Date.now(),
        createdBy: "system",
      })

      await ctx.db.insert("channels", {
        slug: ch.slug,
        name: ch.name,
        description: ch.description,
        type: ch.type,
        gateRequirement: ch.gateRequirement,
        members: [],
        conversationId,
        xCommunityId: ch.xCommunityId,
        onChainAttestation: ch.onChainAttestation,
        createdAt: Date.now(),
        createdBy: "system",
      })
    }

    return "Channels seeded"
  },
})

// Seed welcome messages in #space-cowboys channel
export const seedSpaceCowboys = mutation({
  handler: async (ctx) => {
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_slug", (q) => q.eq("slug", "#space-cowboys"))
      .first()

    if (!channel || !channel.conversationId) {
      return "Run seedChannels:seed first"
    }

    // Check if messages already exist
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", channel.conversationId!)
      )
      .first()

    if (existing) return "Space Cowboys already seeded"

    const now = Date.now()
    const messages = [
      {
        senderId: "system",
        senderName: "JettChat",
        content: "Welcome to #space-cowboys — the front door of JettChat.",
        messageType: "system" as const,
        tensor: undefined,
        source: "jettchat" as const,
      },
      {
        senderId: "EFvgELE1Hb4PC5tbPTAe8v1uEDGee8nwYBMCU42bZRGk",
        senderName: "AstroJOE",
        content: "Hey! I'm JOE — your autonomous agent in the OPTX network. I live on a Jetson Orin Nano, talk through Matrix, and my memory runs on SpacetimeDB. Ask me anything.",
        messageType: "joe" as const,
        tensor: "COG" as const,
        source: "agent" as const,
      },
      {
        senderId: "system",
        senderName: "JettChat",
        content: "This channel is public — no token gate required. Explore #mojo (12 JTX) and #dojo (444 JTX) for gated, on-chain attested channels.",
        messageType: "system" as const,
        tensor: undefined,
        source: "jettchat" as const,
      },
    ]

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      await ctx.db.insert("messages", {
        conversationId: channel.conversationId,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        messageType: msg.messageType,
        tensor: msg.tensor,
        source: msg.source,
        createdAt: now + i * 1000, // 1s apart
      })
    }

    // Update conversation preview
    await ctx.db.patch(channel.conversationId, {
      lastMessageAt: now + 2000,
      lastMessagePreview: "Explore #mojo (12 JTX) and #dojo (444 JTX)...",
    })

    return "Space Cowboys messages seeded"
  },
})
