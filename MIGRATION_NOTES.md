# Convex → SpacetimeDB Migration Notes

## Phase 1 — Completed (Apr 2026)

| Component | Before | After |
|-----------|--------|-------|
| `lib/spacetimedb.ts` | (new) | HTTP client; sqlQuery, getUserByXHandle, getUserByZitadelSub, listAgents, getAgent, listVoiceSessions |
| `app/api/db/sql/route.ts` | (new) | Server-side proxy: forwards SELECT queries to Jetson :3000, blocks writes |
| `components/chat/MyAgents.tsx` | Convex `useQuery(api.agents.listActive)` | SpacetimeDB `listAgents()` via HTTP client |
| `components/SpacetimeUserSync.tsx` | (new) | Replaces ConvexUserSync; calls `upsert_user` reducer (graceful 404 until Phase 2) |
| `app/providers.tsx` | ConvexUserSync only | Both ConvexUserSync + SpacetimeUserSync (parallel, Phase 1 bridge) |
| `.env.local` | (no SpacetimeDB var) | Added `SPACETIME_HTTP_URL=http://100.85.183.16:3000/v1/database/jettchat` |

Convex (`ConvexProvider`, `lib/convex.ts`, `ConversationList.tsx`, `ChatThread.tsx`) remains
untouched pending Phase 2 module work.

---

## Phase 2 — Required jettchat-module Changes

The following changes are needed in `/home/jettoptx/joe-core/jettchat-module/src/lib.rs`
on the Jetson Orin Nano before Phase 2 frontend migration can proceed.

### New Tables

#### `jtx_conversation`
```rust
#[spacetimedb::table(name = jtx_conversation, public)]
pub struct JtxConversation {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub created_at: Timestamp,
    pub updated_at: Option<Timestamp>,
    pub conversation_type: String,   // "dm" | "group" | "channel"
    pub participants: Vec<String>,   // x_id strings
    pub is_encrypted: bool,
    pub name: Option<String>,
    pub slug: Option<String>,        // URL-safe identifier
    pub last_message_at: Option<Timestamp>,
    pub last_message_preview: Option<String>,
    pub created_by: String,
}
```

#### `jtx_channel`
```rust
#[spacetimedb::table(name = jtx_channel, public)]
pub struct JtxChannel {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub created_at: Timestamp,
    pub slug: String,                // "$jettchat" | "#dojo" | "#mojo"
    pub name: String,
    pub description: Option<String>,
    pub channel_type: String,        // "public" | "gated" | "private"
    pub gate_requirement: Option<String>,  // "$OPTX:100" | "JTX:1"
    pub members: Vec<String>,        // x_id strings
    pub conversation_id: Option<u64>,
    pub x_community_id: Option<String>,
    pub on_chain_attestation: bool,
    pub last_attestation_tx: Option<String>,
    pub created_by: String,
}
```

#### `jtx_message_request`
```rust
#[spacetimedb::table(name = jtx_message_request, public)]
pub struct JtxMessageRequest {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub created_at: Timestamp,
    pub from_user_id: String,
    pub to_user_id: String,
    pub status: String,             // "pending" | "accepted" | "declined"
    pub conversation_id: Option<u64>,
    pub responded_at: Option<Timestamp>,
}
```

### Schema Changes to Existing Tables

#### `jtx_message` — add `conversation_id` field
```rust
// Add to JtxMessage struct:
pub conversation_id: Option<u64>,
```

### New Reducers

#### `upsert_user` (NEEDED NOW — Phase 1 SpacetimeUserSync calls this)
```rust
#[spacetimedb::reducer]
pub fn upsert_user(
    ctx: &ReducerContext,
    x_id: String,
    x_handle: String,
    display_name: String,
    avatar_url: String,
    verified: Option<bool>,
) -> Result<(), String> {
    // INSERT OR UPDATE jtx_user WHERE x_id = x_id
    // Sets username, display_name, avatar_url, updated_at = now
    // Creates new row if x_id not found
}
```

#### `create_conversation`
```rust
#[spacetimedb::reducer]
pub fn create_conversation(
    ctx: &ReducerContext,
    conversation_type: String,
    participants: Vec<String>,
    is_encrypted: bool,
    name: Option<String>,
    slug: Option<String>,
) -> Result<u64, String>  // returns new conversation id
```

#### `send_message`
```rust
#[spacetimedb::reducer]
pub fn send_message(
    ctx: &ReducerContext,
    conversation_id: u64,
    content: String,
    encrypted_content: Option<String>,
    nonce: Option<String>,
    sender_public_key: Option<String>,
    message_type: String,
    tensor: Option<String>,
    relay_to_x: bool,
    reply_to_id: Option<u64>,
) -> Result<u64, String>  // returns new message id
```

#### `create_channel`
```rust
#[spacetimedb::reducer]
pub fn create_channel(
    ctx: &ReducerContext,
    slug: String,
    name: String,
    description: Option<String>,
    channel_type: String,
    gate_requirement: Option<String>,
) -> Result<u64, String>
```

#### `join_channel`
```rust
#[spacetimedb::reducer]
pub fn join_channel(ctx: &ReducerContext, channel_id: u64) -> Result<(), String>
```

#### `request_message` (DM request flow)
```rust
#[spacetimedb::reducer]
pub fn request_message(ctx: &ReducerContext, to_x_id: String) -> Result<u64, String>
```

#### `respond_message_request`
```rust
#[spacetimedb::reducer]
pub fn respond_message_request(
    ctx: &ReducerContext,
    request_id: u64,
    accept: bool,
) -> Result<(), String>
```

---

## Phase 2 Frontend Migration Plan

Once the module changes above are deployed to Jetson (rebuild + spacetime publish):

1. Add `app/api/db/reducer/[name]/route.ts` — proxy for reducer calls (POST to `/v1/database/jettchat/call/:name`)
2. Migrate `ConversationList.tsx` — replace Convex `useQuery(api.conversations.list)` with SpacetimeDB HTTP polling or WebSocket subscription
3. Migrate `ChatThread.tsx` — replace Convex real-time messages with SpacetimeDB subscription on `jtx_message WHERE conversation_id = ?`
4. Remove `ConvexUserSync` from `providers.tsx` (SpacetimeUserSync takes over fully)
5. Once all queries migrated, remove `ConvexProvider` + `convex` package

---

## SpacetimeDB SQL Limitations (keep in mind)

- NO `ORDER BY` — sort client-side
- NO `LIKE` — filter client-side with `.filter(row => row.field.includes(term))`
- NO subqueries in WHERE
- NO CREATE/INSERT/UPDATE/DELETE via SQL — use reducers
- Mutations go through: `POST /v1/database/jettchat/call/<reducer_name>`
- SQL endpoint: `POST /v1/database/jettchat/sql` with `Content-Type: text/plain`
