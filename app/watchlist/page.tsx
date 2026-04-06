import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";

export default function WatchlistPage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="badge-pro mb-4 inline-block">PRO</span>
          <h1 className="text-2xl font-bold text-text-primary mb-4">Unlock Watchlist</h1>
          <ul className="text-text-secondary text-sm space-y-2 mb-6 text-left">
            <li>Scheduled runs (daily/weekly/monthly)</li>
            <li>Custom frequency monitoring</li>
            <li>Up to 10 active lookouts</li>
          </ul>
          <Link href="/settings" className="px-4 py-2 bg-accent text-background rounded-xl font-medium text-sm hover:bg-accent-muted transition-colors">
            Upgrade
          </Link>
        </div>
      </main>
    </>
  );
}
