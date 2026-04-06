export default function VoicePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center bg-background">
      <h1 className="font-display text-3xl font-bold text-accent mb-4">Voice</h1>
      {/* Animated orb placeholder */}
      <div className="w-40 h-40 rounded-full bg-gradient-to-br from-accent/30 to-accent/5 animate-glow-pulse mb-8" />
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm text-center">
        <span className="badge-pro mb-3 inline-block">PRO</span>
        <h2 className="text-text-primary font-medium mb-2">Voice Conversations</h2>
        <ul className="text-text-secondary text-sm space-y-1 mb-4">
          <li>Real-time web search</li>
          <li>5 voice options</li>
          <li>AI-powered responses</li>
        </ul>
        <a href="/settings" className="inline-block px-4 py-2 bg-accent text-background rounded-xl font-medium text-sm hover:bg-accent-muted transition-colors">
          Upgrade to PRO
        </a>
      </div>
    </main>
  );
}
