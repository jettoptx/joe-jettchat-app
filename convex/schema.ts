import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // User profiles — X OAuth + wallet identity
  users: defineTable({
    xId: v.optional(v.string()),
    username: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    solanaWallet: v.optional(v.string()),
    tempoWallet: v.optional(v.string()),
    // E2E public key (X25519) for key exchange
    publicKey: v.optional(v.string()),
    // Legacy Clerk fields (existing data)
    clerkId: v.optional(v.string()),
    email: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  })
    .index("by_xId", ["xId"])
    .index("by_username", ["username"])
    .index("by_wallet", ["solanaWallet"]),

  // Agents — autonomous identities with reputation
  agents: defineTable({
    xHandle: v.string(),
    solanaWallet: v.string(),
    publicKey: v.optional(v.string()),
    agentType: v.string(), // "joe" | "astrojoe" | "traderjoe" | "custom"
    ownerXId: v.optional(v.string()), // X user ID of the agent owner
    status: v.optional(v.string()), // "online" | "offline" | "syncing"
    capabilities: v.optional(v.array(v.string())), // ["grok", "search", "trade", ...]
    lastSeenAt: v.optional(v.number()),
    // x402 micropayment policy
    x402Policy: v.optional(v.object({
      maxPerRequest: v.optional(v.number()),
      currency: v.optional(v.string()),
      enabled: v.boolean(),
    })),
    // ERC-8002 agent reputation score
    erc8002Score: v.optional(v.number()),
    erc8002Registry: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  })
    .index("by_xHandle", ["xHandle"])
    .index("by_wallet", ["solanaWallet"])
    .index("by_owner", ["ownerXId"]),

  // Conversations — DMs, groups, channels
  conversations: defineTable({
    type: v.string(), // "dm" | "group" | "channel"
    participants: v.array(v.string()), // xId strings
    isEncrypted: v.boolean(),
    name: v.optional(v.string()), // for groups/channels: "$jettchat", "#dojo", "#mojo"
    slug: v.optional(v.string()), // URL-safe identifier
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_lastMessage", ["lastMessageAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_slug", ["slug"]),

  // Messages — only ciphertext stored for E2E conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.optional(v.string()),
    content: v.string(), // plaintext for channels, ciphertext for E2E
    encryptedContent: v.optional(v.string()),
    nonce: v.optional(v.string()),
    senderPublicKey: v.optional(v.string()),
    messageType: v.string(), // "chat" | "system" | "joe" | "agent"
    tensor: v.optional(v.string()), // "COG" | "EMO" | "ENV"
    // X Community bridge fields
    source: v.optional(v.string()), // "jettchat" | "x_community" | "agent"
    xTweetId: v.optional(v.string()), // original tweet ID if sourced from X
    relayToX: v.optional(v.boolean()), // whether Edge JOE should relay to X community
    // On-chain attestation references
    attestationRoot: v.optional(v.string()), // Merkle root this message was attested under
    attestationTx: v.optional(v.string()), // Solana tx signature of attestation
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_sender", ["senderId"]),

  // Channels — persistent topic rooms
  channels: defineTable({
    slug: v.string(), // "$jettchat", "#dojo", "#mojo"
    name: v.string(),
    description: v.optional(v.string()),
    type: v.string(), // "public" | "gated" | "private"
    gateRequirement: v.optional(v.string()), // token gate: "$OPTX:100" or "JTX:1"
    members: v.array(v.string()),
    conversationId: v.optional(v.id("conversations")),
    // X Community bridge
    xCommunityId: v.optional(v.string()), // linked X community ID
    // On-chain attestation config
    onChainAttestation: v.optional(v.boolean()), // whether messages get on-chain proofs
    lastAttestationTx: v.optional(v.string()), // latest confirmed Solana attestation tx
    createdAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_type", ["type"]),

  // Attestations — batched Merkle-root proofs anchored to Solana
  attestations: defineTable({
    channelSlug: v.string(),
    merkleRoot: v.string(),
    messageHashes: v.array(v.string()),
    messageCount: v.number(),
    batchIndex: v.number(),
    txSignature: v.optional(v.string()), // set once confirmed on-chain
    status: v.string(), // "pending" | "confirmed" | "failed"
    createdAt: v.number(),
  })
    .index("by_channel", ["channelSlug", "batchIndex"]),

  // Message requests — X-style DM request flow
  messageRequests: defineTable({
    fromUserId: v.string(),
    toUserId: v.string(),
    status: v.string(), // "pending" | "accepted" | "declined"
    conversationId: v.optional(v.id("conversations")),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
  })
    .index("by_recipient", ["toUserId", "status"])
    .index("by_sender", ["fromUserId"]),
})
