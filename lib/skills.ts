/**
 * lib/skills.ts — Hermes skill registry for JettChat
 *
 * Defines all slash-command-invocable agent skills. Skills are routed through
 * HEDGEHOG MCP on Jetson :8811, TraderJOE, or handled locally.
 */

export type SkillCategory =
  | "crypto"
  | "trading"
  | "gaze"
  | "system"
  | "search";

export interface Skill {
  name: string;
  slug: string;
  description: string;
  agentType: string;
  category: SkillCategory;
  requiresTier?: "mojo" | "dojo" | null;
  x402Cost?: number; // JTX micropayment cost; 0 = free
  usage?: string;    // example usage string shown in /help
}

export const SKILL_REGISTRY: Skill[] = [
  {
    name: "Grok Query",
    slug: "grok",
    description: "Query Grok via HEDGEHOG MCP on Jetson",
    agentType: "hedgehog",
    category: "system",
    requiresTier: null,
    x402Cost: 0,
    usage: "/grok <query>",
  },
  {
    name: "Trade",
    slug: "trade",
    description: "Fetch TraderJOE market data for a trading pair",
    agentType: "traderjoe",
    category: "trading",
    requiresTier: "mojo",
    x402Cost: 0,
    usage: "/trade <pair>",
  },
  {
    name: "Stake",
    slug: "stake",
    description: "Check JTX staking status for an amount",
    agentType: "optx",
    category: "crypto",
    requiresTier: null,
    x402Cost: 0,
    usage: "/stake <amount>",
  },
  {
    name: "Attest",
    slug: "attest",
    description: "Force-submit the current attestation batch to AARON",
    agentType: "aaron",
    category: "crypto",
    requiresTier: "dojo",
    x402Cost: 0,
    usage: "/attest",
  },
  {
    name: "Gaze",
    slug: "gaze",
    description: "Show current AGT tensor analysis (COG/EMO/ENV)",
    agentType: "hedgehog",
    category: "gaze",
    requiresTier: "mojo",
    x402Cost: 0,
    usage: "/gaze",
  },
  {
    name: "Map of Augments",
    slug: "moa",
    description: "Toggle the Map of Augments overlay",
    agentType: "local",
    category: "system",
    requiresTier: null,
    x402Cost: 0,
    usage: "/moa",
  },
  {
    name: "Bridge",
    slug: "bridge",
    description: "Relay a message to the X community via JOE",
    agentType: "joe",
    category: "system",
    requiresTier: null,
    x402Cost: 0,
    usage: "/bridge <message>",
  },
  {
    name: "Wallet",
    slug: "wallet",
    description: "Show connected wallet info (Solana + XRPL)",
    agentType: "local",
    category: "crypto",
    requiresTier: null,
    x402Cost: 0,
    usage: "/wallet",
  },
  {
    name: "Trust",
    slug: "trust",
    description: "Check the trust score of an agent or address",
    agentType: "aaron",
    category: "system",
    requiresTier: null,
    x402Cost: 0,
    usage: "/trust <agent>",
  },
  {
    name: "Help",
    slug: "help",
    description: "List all available skills and slash commands",
    agentType: "local",
    category: "system",
    requiresTier: null,
    x402Cost: 0,
    usage: "/help",
  },
];

/**
 * Parse a raw chat input string and return the matching Skill (if any).
 *
 * Handles forms: "/grok", "/grok query text", "/GROK"
 * Returns null for non-slash inputs.
 */
export function findSkill(input: string): Skill | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  // Extract the command token — everything between "/" and the first space
  const commandToken = trimmed.slice(1).split(/\s+/)[0].toLowerCase();
  if (!commandToken) return null;

  return (
    SKILL_REGISTRY.find((s) => s.slug === commandToken) ?? null
  );
}

/**
 * Extract the argument string that follows a slash command.
 * e.g. "/grok what is a knot polynomial?" → "what is a knot polynomial?"
 */
export function extractSkillArgs(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return trimmed;
  const parts = trimmed.split(/\s+/);
  return parts.slice(1).join(" ");
}

/**
 * Filter the registry for a partial slug prefix — used by SkillPicker autocomplete.
 * e.g. "gr" → [grok]
 */
export function filterSkills(partial: string): Skill[] {
  const lower = partial.toLowerCase();
  return SKILL_REGISTRY.filter((s) => s.slug.startsWith(lower));
}
