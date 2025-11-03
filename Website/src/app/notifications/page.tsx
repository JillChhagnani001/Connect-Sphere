import { AppShell } from "@/components/app-shell";
import CollabInvites from "@/components/notifications/collab-invites";

export default function NotificationsPage() {
  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Notifications</h1>
      <div className="space-y-6">
        <CollabInvites />
      </div>
    </AppShell>
  );
}
