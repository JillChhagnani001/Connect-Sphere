"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUnreadCount, subscribeToNotifications } from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
  const [unread, setUnread] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const count = await getUnreadCount();
      setUnread(count);
      unsub = subscribeToNotifications((n) => {
        setUnread((c) => c + 1);
        toast({
          title: n.title ?? "New notification",
          description: n.body ?? undefined,
        });
      }, user.id);
    })();
    return () => {
      unsub?.();
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


