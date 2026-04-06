import { Sidebar } from "@/components/layout/Sidebar";

const INTEGRATIONS = [
  { name: "X / Twitter", category: "Social", icon: "𝕏" },
  { name: "Solana", category: "Blockchain", icon: "◎" },
  { name: "Matrix", category: "Messaging", icon: "▣" },
  { name: "SpacetimeDB", category: "Database", icon: "⟐" },
  { name: "HEDGEHOG MCP", category: "AI", icon: "🦔" },
  { name: "Grok", category: "AI", icon: "xI" },
  { name: "Tempo CLI", category: "Payments", icon: "₮" },
  { name: "JOE Agent", category: "Agent", icon: "🤖" },
];

const CATEGORIES = ["All", "AI", "Blockchain", "Social", "Messaging", "Database", "Payments", "Agent"];

export default function IntegrationsPage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="px-6 h-14 flex items-center gap-3 border-b border-border">
          <h1 className="text-lg font-medium text-text-primary">JettChat Apps</h1>
          <span className="bg-card border border-border rounded-full px-2 py-0.5 text-xs text-text-secondary">
            Marketplace
          </span>
        </div>

        <div className="p-6 space-y-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search apps..."
            className="w-full max-w-md bg-card border border-border rounded-xl px-4 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
          />

          {/* Category filters */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className="px-3 py-1 rounded-full text-xs border border-border text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {INTEGRATIONS.map((app) => (
              <div
                key={app.name}
                className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-accent/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-lg">
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{app.name}</p>
                  <p className="text-xs text-text-muted">{app.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
