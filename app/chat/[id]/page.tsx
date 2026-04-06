import { Sidebar } from "@/components/layout/Sidebar";
import { ChatThread } from "@/components/chat/ChatThread";

export default function ChatPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col relative">
        <ChatThread threadId={params.id} />
      </main>
    </>
  );
}
