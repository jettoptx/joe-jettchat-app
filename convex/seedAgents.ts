import { mutation } from "./_generated/server"

// Seed core agents — run once via Convex dashboard or `npx convex run seedAgents:seed`
export const seed = mutation({
  handler: async (ctx) => {
    const coreAgents = [
      {
        xHandle: "@astrojoe",
        displayName: "AstroJOE",
        solanaWallet: "G8MxbW8LKEsvKvXRneCHpMASR4yDit7CzERW1ZfgPkqD",
        agentType: "astrojoe",
        ownerXId: "jettoptx",
        status: "online",
        capabilities: ["grok", "search", "analyze", "attest", "welcome"],
        erc8002Score: 92,
        erc8002Registry: "solana:101:metaplex",
      },
      {
        xHandle: "@edgejoe",
        displayName: "Edge JOE",
        solanaWallet: "PJM2Y4xqCSqxX1g9AWN5ejy8s6o9SeGfUTbj2cKEycs",
        agentType: "joe",
        ownerXId: "jettoptx",
        status: "online",
        capabilities: ["bridge", "relay", "monitor"],
        erc8002Score: 88,
      },
      {
        xHandle: "@traderjoe_xrp",
        displayName: "TraderJOE",
        solanaWallet: "rq9mNYMKhzy9EgmBmwfWKn6fs5qgPpVmk",
        agentType: "traderjoe",
        ownerXId: "jettoptx",
        status: "syncing",
        capabilities: ["trade", "lp", "grid", "oracle"],
        erc8002Score: 76,
      },
    ]

    let seeded = 0
    for (const agent of coreAgents) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_xHandle", (q) => q.eq("xHandle", agent.xHandle))
        .first()

      if (existing) continue

      await ctx.db.insert("agents", {
        ...agent,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        isActive: true,
      })
      seeded++
    }

    return `Seeded ${seeded} agents (${coreAgents.length - seeded} already existed)`
  },
})
