// Channel gate verification — checks JTX balance against tier thresholds
// Mirrors astroknots.space/staking tier structure:
//   MOJO:  12 JTX  ($8.88/mo)
//   DOJO: 444 JTX  ($28.88/6mo)

const JTX_MINT = "9XpJiKEYzq5yDo5pJzRfjSRMPL2yPfDQXgiN7uYtBhUj"
const FOUNDER_WALLET = "FEUwuvXbbSYTCEhhqgAt2viTsEnromNNDsapoFvyfy3H"

interface GateResult {
  allowed: boolean
  tier: "public" | "basic" | "mojo" | "dojo" | "spaceCowboy"
  jtxBalance: number
}

// Parse gate requirement string like "JTX:444"
function parseGate(gateRequirement: string): { token: string; amount: number } {
  const [token, amount] = gateRequirement.split(":")
  return { token, amount: Number(amount) }
}

export async function checkChannelGate(
  wallet: string | undefined,
  gateRequirement: string | undefined
): Promise<GateResult> {
  // Public channels — always allowed
  if (!gateRequirement) {
    return { allowed: true, tier: "public", jtxBalance: 0 }
  }

  // No wallet — can't check gate
  if (!wallet) {
    return { allowed: false, tier: "public", jtxBalance: 0 }
  }

  // Founder wallet — automatic access
  if (wallet === FOUNDER_WALLET) {
    return { allowed: true, tier: "spaceCowboy", jtxBalance: Infinity }
  }

  const { token, amount: required } = parseGate(gateRequirement)

  if (token !== "JTX") {
    return { allowed: false, tier: "public", jtxBalance: 0 }
  }

  // Check JTX balance via existing API pattern
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333"
  try {
    const res = await fetch(`${appUrl}/api/jtx-check?wallet=${wallet}`)
    if (!res.ok) return { allowed: false, tier: "public", jtxBalance: 0 }

    const data = await res.json()
    const balance = data.balance ?? 0

    // Determine tier from balance
    let tier: GateResult["tier"] = "public"
    if (balance >= 1111) tier = "spaceCowboy"
    else if (balance >= 444) tier = "dojo"
    else if (balance >= 12) tier = "mojo"
    else if (balance >= 1) tier = "basic"

    return {
      allowed: balance >= required,
      tier,
      jtxBalance: balance,
    }
  } catch {
    return { allowed: false, tier: "public", jtxBalance: 0 }
  }
}

// Tier thresholds — matches astroknots.space/staking
export const TIERS = {
  mojo: { jtx: 12, fiat: "$8.88/mo", optxRate: "12 OPTX/mo" },
  dojo: { jtx: 444, fiat: "$28.88/6mo", optxRate: "444 OPTX/mo" },
  spaceCowboy: { jtx: 1111, fiat: "$88.88/mo", optxRate: "Unlimited" },
} as const
