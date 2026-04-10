import { ChatLayout } from "@/components/layout/ChatLayout";
import { ChatThread } from "@/components/chat/ChatThread";

export default function ChatPage({ params }: { params: { id: string } }) {
  return (
    <ChatLayout>
      <ChatThread threadId={params.id} />
    </ChatLayout>
  );
}
