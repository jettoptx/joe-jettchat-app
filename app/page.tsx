import { Sidebar } from "@/components/layout/Sidebar";
import { HomeChat } from "@/components/chat/HomeChat";

export default function HomePage() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col items-center justify-center relative">
        <HomeChat />
      </main>
    </>
  );
}
