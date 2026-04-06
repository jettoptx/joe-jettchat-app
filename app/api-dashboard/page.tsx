import { Sidebar } from "@/components/layout/Sidebar";

export default function APIDashboardPage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="px-6 h-14 flex items-center border-b border-border">
          <h1 className="text-lg font-medium text-text-primary">API Dashboard</h1>
        </div>

        <div className="p-6 space-y-4">
          {/* Plan banner */}
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
            <p className="text-accent text-sm font-medium">Free Plan</p>
            <p className="text-text-secondary text-xs">20 API calls/day</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-text-muted text-xs mb-1">API Key</p>
              <p className="text-text-primary text-sm font-mono">jc_••••••••</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-text-muted text-xs mb-1">Total Requests</p>
              <p className="text-text-primary text-lg font-medium">0</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-text-muted text-xs mb-1">Remaining Today</p>
              <p className="text-accent text-lg font-medium">20</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-text-muted text-xs mb-1">Daily Limit</p>
              <p className="text-text-primary text-lg font-medium">20</p>
            </div>
          </div>

          {/* API key management */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-text-primary text-sm font-medium">API Keys</h2>
              <button className="bg-accent text-background text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-accent-muted transition-colors">
                Create Key
              </button>
            </div>
            <p className="text-text-muted text-xs mt-2">No API keys yet.</p>
          </div>
        </div>
      </main>
    </>
  );
}
