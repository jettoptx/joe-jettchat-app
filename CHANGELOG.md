# Changelog

All notable changes to JettChat are documented here.

## [0.2.0] — 2026-04-11

### Deployed
- **jettchat-attestation program** deployed to Solana devnet
  - Program ID: `wLiceDyLcJAg3SeB86ccnqWgB4Ss7YprqApaP9kaXhY`
  - Deploy tx: [`QABcJsMs...u1gJR`](https://explorer.solana.com/tx/QABcJsMspfSDYBXEkZauABCXKKChcLsQj3xf5RFZ89GEhM1K3dDo9RR1iSB9DL4nxciCz5K543zrzX6gt6u1gJR?cluster=devnet)
  - Binary: 321 KB (Anchor 0.30.1, Solana 1.18)
  - 9 instructions, 4 PDA types, dual authority (Founder + JOE)

### Added
- `components/hub/JettHub.tsx` — DOJO orbital navigation ported to JettChat HOME
  - Mercedes-pattern SVG lines, AGT tensor coloring (COG/EMO/ENV)
  - Animated pan+grow node navigation, orbital ring layout
  - Routes: `/chat`, `/agents`, `/settings`, `/training`
- `hooks/useSession.ts` — X OAuth session hook (reads `x_profile` cookie)
- `lib/attestation.ts` — Client-side Anchor program bindings for on-chain attestations

### Changed
- `app/page.tsx` — HOME now renders NavRail + JettHub (replaces empty ConversationList)
- `components/chat/ConversationList.tsx` — replaced `MOCK_CONVERSATIONS` with `useQuery(api.conversations.listForUser)`, added loading spinner and empty states
- `components/chat/ChatThread.tsx` — replaced `MOCK_THREADS` with Convex `getById` + `listByConversation` queries, real-time message hydration
- `Anchor.toml` — updated program IDs from placeholder to deployed address
- `programs/jettchat-attestation/src/lib.rs` — updated `declare_id!` to deployed program address
- `programs/jettchat-attestation/Cargo.toml` — added `idl-build` feature

### Architecture
- Convex schema LIVE (8 tables, E2EE fields, indexes)
- X OAuth PKCE BUILT (JWT session + `x_profile` cookie)
- E2E encryption BUILT (TKDF + X25519 + NaCl SecretBox)
- WebSocket transport BUILT (`useJettChatWS` → Jetson :8765)
- On-chain attestations DEPLOYED (devnet)

## [0.1.0] — 2026-04-01

### Added
- Initial JettChat app scaffold (Next.js 14 + shadcn/ui + orange theme)
- Three-panel X Chat clone layout (NavRail + ConversationList + ChatThread)
- Convex integration with 8-table schema
- E2E encryption SDK integration (TKDF + X25519 + NaCl SecretBox)
- X OAuth 2.0 PKCE auth flow
- WebSocket transport to Jetson edge node
- Anchor program source (jettchat-attestation, 1,144 lines)
- Channel and agent seed scripts

> Luke 18:31
