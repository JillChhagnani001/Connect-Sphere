"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotificationPayload } from "@/lib/notifications";
import { getUnreadCount, subscribeToNotifications } from "@/lib/notifications";
import { useEventListener } from "usehooks-ts";
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
  const [unread, setUnread] = useState<number>(0);
  const { toast } = useToast();

  const refreshUnreadCount = useCallback(async () => {
    const count = await getUnreadCount();
    setUnread(count);
  }, []);

  const handleRealtimeNotification = useCallback((n: NotificationPayload) => {
    setUnread((c) => c + 1);
    toast({
      title: n.title ?? "New notification",
      description: n.body ?? undefined,
    });
  }, [toast]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const bootstrap = async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await refreshUnreadCount();
      unsub = subscribeToNotifications(handleRealtimeNotification, user.id);
    };

    void bootstrap();
    return () => {
      unsub?.();
    };
  }, [handleRealtimeNotification, refreshUnreadCount]);

  useEventListener("notifications:refresh", () => {
    void refreshUnreadCount();
  });

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


