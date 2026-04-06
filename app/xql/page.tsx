import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";

export default function XQLPage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="badge-pro mb-4 inline-block">PRO</span>
          <h1 className="text-2xl font-bold text-text-primary mb-4">Unlock XQL</h1>
          <ul className="text-text-secondary text-sm space-y-2 mb-6 text-left">
            <li>Natural language X post queries</li>
            <li>SQL-like query generation</li>
            <li>Advanced filtering and analytics</li>
          </ul>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="px-4 py-2 border border-border rounded-xl text-text-secondary hover:text-text-primary text-sm transition-colors">
              Back to Chat
            </Link>
            <Link href="/settings" className="px-4 py-2 bg-accent text-background rounded-xl font-medium text-sm hover:bg-accent-muted transition-colors">
              Upgrade
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
