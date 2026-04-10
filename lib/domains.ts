/**
 * Domain architecture for Jett Optical Platform
 *
 * jettoptx.chat   — JettChat (this app), E2E encrypted messaging
 * jettoptx.dev    — Developer docs, API reference
 * docs.jettoptx.dev — Full documentation site
 * jettoptics.ai   — Main marketing site + DOJO staking portal
 * astroknots.space — OPTX-Cortex Obsidian vault (public knowledge base)
 */

export const DOMAINS = {
  /** JettChat — main app domain */
  chat: "https://jettoptx.chat",
  /** Developer documentation */
  dev: "https://jettoptx.dev",
  /** Full docs site */
  docs: "https://docs.jettoptx.dev",
  /** Main corporate / staking site */
  main: "https://jettoptics.ai",
  /** OPTX-Cortex knowledge base */
  cortex: "https://astroknots.space",
  /** Stripe payment link — JettChat Access ($8 one-time = 1 JTX) */
  stripeAccess: "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801",
} as const;

/** Stripe product/price IDs */
export const STRIPE = {
  products: {
    jettchatAccess: "prod_UJ3apCpLVbZRww",
    mojo: "prod_Tu0OGpffZsf6pw",
    dojo: "prod_Tu0RaGRXBaaLGp",
    spaceCowboy: "prod_TwZUBhoeIlmtqo",
    jtxDonation: "prod_Tu0W378RyoO30E",
  },
  prices: {
    jettchatAccess: "price_1TKRZ9JxIltc1pGhwmrnsVfF",
  },
  paymentLinks: {
    jettchatAccess: "https://buy.stripe.com/eVq8wQgcq0m7a8x84TgA801",
  },
} as const;
