import { AppShell } from "@/components/app-shell";
import { NotificationList } from "@/components/notifications/notification-list";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CollabInvites from "@/components/notifications/collab-invites";
import { FollowRequests } from "@/components/feed/follow-requests"; // ✨ Import this

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Notifications</h1>
      
      <div className="space-y-8">
        {/* ✨ Add the FollowRequests component here */}
        <FollowRequests currentUserId={user.id} />
        
        {/* Your other notification components */}
        <CollabInvites />
        <NotificationList />
      </div>
    </AppShell>
  );
}