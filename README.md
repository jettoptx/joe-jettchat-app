# JettChat

Encrypted AI chat powered by OPTX. Clean-room build inspired by Scira's UX patterns — proprietary, no AGPL code.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: `@jettoptx/auth` (X OAuth 2.0 PKCE + Solana signMessage + Ed25519 JWT)
- **Encryption**: `@jettoptx/chat` (X25519 + NaCl SecretBox + TKDF hybrid)
- **Wallet**: Phantom via `@solana/wallet-adapter`
- **RPC**: Helius
- **Styling**: Tailwind CSS + shadcn/ui patterns
- **Icons**: Lucide React

## Pages

| Route | Page | Gate |
|-------|------|------|
| `/` | Home — chat input, model selector, filter pills | Public |
| `/chat/[id]` | Chat thread — messages, citations, follow-ups | Auth |
| `/login` | Login — "Verify with X" + "Connect Wallet" | Public |
| `/threads` | Thread library — search, filter, sort | Auth |
| `/settings` | Settings — 6 tabs (Usage, Subscription, Preferences, Connectors, Memories, Uploads) | Auth |
| `/integrations` | Apps marketplace — 8 integration cards | Auth |
| `/xql` | XQL query interface | PRO |
| `/watchlist` | Lookout/watchlist | PRO |
| `/voice` | Voice interface — full-screen animated orb | PRO |
| `/agent` | Agent sandbox — cloud sandbox, code exec | SPACE COWBOY |
| `/api-dashboard` | API stats + key management | Auth |

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0a0a0a` | Page background |
| `--surface` | `#111111` | Sidebar, panels |
| `--card` | `#1a1a1a` | Cards, modals |
| `--border` | `#2a2a2a` | Subtle borders |
| `--accent` | `#f5e6c8` | Cream/gold — buttons, active states, badges |
| `--text-primary` | `#e8e8e8` | Body text |
| `--text-secondary` | `#888888` | Muted text |

Sidebar: 210px wide, collapsible, amber gradient glow on left edge.

## Getting Started

### Prerequisites

```bash
# Sibling SDK repos must exist (linked via file: protocol)
../joe-jettauth-optx/   # @jettoptx/auth
../joe-jettchat-sdk/    # @jettoptx/chat
```

### Install & Run

```bash
npm install
npm run dev          # http://localhost:3000
```

### Environment

```env
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=<key>
NEXT_PUBLIC_APP_URL=https://jettoptics.ai
X_CLIENT_ID=WE1WN1ZMRVIzVWNSWmRZZHFzVVM6MTpjaQ
X_CLIENT_SECRET=<server-only>
JWT_SIGNING_KEY=<Ed25519 private key, base64>
JWT_PUBLIC_KEY=<Ed25519 public key, base64>
```

## Auth Flow

```
1. User clicks "Verify with X" ──> X OAuth 2.0 PKCE redirect
   OR "Connect Wallet" ──> Phantom signMessage nonce challenge

2. Callback/verify ──> Ed25519 JWT issued ──> HttpOnly cookie "jettauth"

3. Middleware checks cookie on protected routes ──> redirect to /login if missing

4. AuthProvider hydrates session from /api/auth/session
```

## Project Structure

```
app/
  (auth)/login/         # Login page (X + Wallet)
  chat/[id]/            # Chat thread
  threads/              # Thread library
  settings/             # Settings (6 tabs)
  integrations/         # Apps marketplace
  xql/                  # XQL (PRO)
  watchlist/            # Lookout (PRO)
  voice/                # Voice (PRO)
  agent/                # Agent (SPACE COWBOY)
  api-dashboard/        # API stats
  layout.tsx            # Root layout
  providers.tsx         # Solana + Auth providers
  globals.css           # Tailwind + OPTX tokens
components/
  layout/Sidebar.tsx    # Collapsible nav sidebar
  chat/HomeChat.tsx     # Home page chat input
  chat/ChatThread.tsx   # Thread message view
middleware.ts           # Route protection
```

## Pricing Tiers

| Tier | Price | API/day | XQL | Voice | Agent |
|------|-------|---------|-----|-------|-------|
| Free | $0 | 20 | -- | -- | -- |
| MOJO | $8.88/mo | 500 | 50 | 10 min | 5 |
| DOJO | $28.88/6mo | 2,000 | 200 | 30 min | 20 |
| Space Cowboy | $88.88/mo | Unlimited | Unlimited | Unlimited | Unlimited |

$0.08 markup per xAI API call. Payments via Tempo CLI / MPP on Solana.

## Integrations

8 built-in integration cards: X, Solana, Matrix, SpacetimeDB, HEDGEHOG, Grok, Tempo CLI, JOE Agent.

## AI Models

- Grok 4.1 Fast (default)
- Grok 4.20
- Claude Opus 4.6

Model selector on the home page input bar.

## License

Proprietary. Clean-room rebuild — no Scira source code.
