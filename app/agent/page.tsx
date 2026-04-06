import { Sidebar } from "@/components/layout/Sidebar";
import Link from "next/link";

export default function AgentPage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="badge-max mb-4 inline-block">SPACE COWBOY</span>
          <h1 className="text-2xl font-bold text-text-primary mb-4">Unlock JOE Agent</h1>
          <ul className="text-text-secondary text-sm space-y-3 mb-6 text-left">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">&#9679;</span>
              <div>
                <p className="text-text-primary font-medium">Cloud Sandbox</p>
                <p className="text-xs uppercase tracking-wider text-text-muted">ISOLATED EXECUTION</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">&#9679;</span>
              <div>
                <p className="text-text-primary font-medium">Web Search</p>
                <p className="text-xs uppercase tracking-wider text-text-muted">REAL-TIME DATA</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">&#9679;</span>
              <div>
                <p className="text-text-primary font-medium">Code Execution</p>
                <p className="text-xs uppercase tracking-wider text-text-muted">PYTHON & JS RUNTIME</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">&#9679;</span>
              <div>
                <p className="text-text-primary font-medium">Multiple Models</p>
                <p className="text-xs uppercase tracking-wider text-text-muted">GROK + CLAUDE + JOE</p>
              </div>
            </li>
          </ul>
          <Link href="/settings" className="px-4 py-2 bg-accent text-background rounded-xl font-medium text-sm hover:bg-accent-muted transition-colors">
            Upgrade to Space Cowboy — $88.88/mo
          </Link>
        </div>
      </main>
    </>
  );
}
