import { mutation } from "./_generated/server"

// Seed default channels — run once via Convex dashboard or CLI
export const seed = mutation({
  handler: async (ctx) => {
    const defaults = [
      {
        slug: "$JTX",
        name: "Jett-Chat",
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
