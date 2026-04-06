import { Sidebar } from "@/components/layout/Sidebar";

export default function ThreadsPage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 h-14 border-b border-border">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-text-primary">Library</h1>
            <span className="bg-card border border-border rounded-full px-2 py-0.5 text-xs text-text-secondary">
              0
            </span>
          </div>
          <button className="bg-accent text-background text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-accent-muted transition-colors">
            + New
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-muted">
          No threads yet. Start a conversation.
        </div>
      </main>
    </>
  );
}
