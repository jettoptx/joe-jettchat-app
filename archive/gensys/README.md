# Archived: /gensys page

**Archived:** 2026-04-17
**Original route:** `/gensys` on jettoptx.chat
**Reason:** Browser-based gaze auth was a sim (hardcoded AGT tensors). Real gaze biometrics require iPhone TrueDepth + ARKit and are moving to the JettOptics mobile app.

## What this was

Three-step demo flow:

1. **Connect** — Phantom wallet
2. **Sign Key** — interactive Jett Keypad (Venn diagram, drag-to-center 6 numbers)
3. **Mint** — placeholder $OPTX devnet mint

The gaze step (`startGaze` in `page.tsx.archived`, lines ~213-258) was theater: a 1.5s `setTimeout` that displayed `AGT: COG[0.92] EMO[0.87] ENV[0.94]` regardless of what the camera saw. It hit the AARON Router on Jetson (`http://100.85.183.16:8888/session`) but ignored the response.

## How to revive

```bash
mkdir -p app/gensys
git mv archive/gensys/page.tsx.archived app/gensys/page.tsx

# Re-add to middleware PUBLIC_ROUTES in middleware.ts
# Re-add redirect target in app/page.tsx (or link from sidebar)
```

## Components preserved

- `components/ui/JettKeypad.tsx` — the Venn-diagram keypad component is still in tree, fully reusable for the mobile flow.

## When to revive

Once one of:

- iOS native app exists with ARKit TrueDepth gaze pipeline → `/gensys` becomes the desktop "scan QR with phone" page
- Browser MediaPipe iris pipeline (468/473 landmarks) is hooked up + AGT computation is real (Shannon entropy ≥ 750 enforced server-side) → can revive as a degraded-mode demo

## Related

- `/voice` — the active desktop AI surface (VoiceJOE / xAI realtime), gate-hardened in PR #5 (commit `1149254`)
- AARON Router — Jetson `:8888`, expects real gaze tensors not the sim payload from this page
