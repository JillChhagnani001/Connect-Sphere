"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUnreadCount, subscribeToNotifications } from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client"; // ✨ Import client

export function NotificationBell() {
  const [unread, setUnread] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    // ✨ Keep track of both subscriptions
    let notificationSub: (() => void) | null = null;
    let followRequestSub: (() => void) | null = null;

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // 1. Get initial count from main notifications
      const notificationCount = await getUnreadCount();

      // 2. Get initial count from follow requests
      const { count: requestCount } = await supabase
        .from('follow_requests')
        .select('', { count: 'exact' })
        .eq('following_id', user.id);

      // 3. Set combined total
      setUnread(notificationCount + (requestCount || 0));

      // 4. Subscribe to main notifications
      notificationSub = subscribeToNotifications((n) => {
        setUnread((c) => c + 1);
        toast({
          title: n.title ?? "New notification",
          description: n.body ?? undefined,
        });
      }, user.id);

      // ✨ 5. Subscribe to new follow requests
      const followChannel = supabase
        .channel('public:follow_requests')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'follow_requests', filter: `following_id=eq.${user.id}` },
          (payload) => {
            // New request for us, increment count
            setUnread((c) => c + 1);
            toast({
              title: "New Follow Request",
              description: "Someone wants to follow you.",
            });
          }
        )
        .subscribe();
      
      // ✨ Store the unsubscribe function
      followRequestSub = () => {
        supabase.removeChannel(followChannel);
      };

    })();
    
    return () => {
      // ✨ Unsubscribe from both
      notificationSub?.();
      followRequestSub?.();
    };
  }, [toast]);

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" className="rounded-full relative">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </Button>
    </Link>
  );
}