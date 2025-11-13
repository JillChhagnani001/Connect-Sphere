import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatLayout } from "@/components/messages/chat-layout";

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <h1 className="text-3xl font-bold tracking-tight mb-8 shrink-0">Messages</h1>
        <Suspense fallback={<div className="flex-1 rounded-lg border bg-muted/30 animate-pulse" />}>
          <ChatLayout />
        </Suspense>
      </div>
    </AppShell>
  );
}
