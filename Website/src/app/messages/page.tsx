import { AppShell } from "@/components/app-shell";
import { ChatLayout } from "@/components/messages/chat-layout";

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <h1 className="text-3xl font-bold tracking-tight mb-8 shrink-0">Messages</h1>
        <ChatLayout />
      </div>
    </AppShell>
  );
}
