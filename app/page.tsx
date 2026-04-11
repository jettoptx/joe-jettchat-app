import { Sidebar } from "@/components/layout/Sidebar";
import { JettHub } from "@/components/hub/JettHub";

export default function HomePage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0">
        <JettHub />
      </main>
    </>
  );
}
