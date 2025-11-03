"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationItem as NotificationType, fetchNotifications, subscribeToNotifications, markAllAsRead } from "@/lib/notifications";
import { NotificationItem } from "./notification-item";

export function NotificationList() {
  const [items, setItems] = useState<NotificationType[] | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user found in NotificationList");
        return;
      }
      
      console.log("Fetching notifications for user:", user.id);
      const initial = await fetchNotifications();
      console.log("Fetched notifications:", initial);
      setItems(initial);
      unsub = subscribeToNotifications((n) => {
        console.log("New notification received:", n);
        setItems((prev) => [n, ...(prev ?? [])]);
      }, user.id);
    })();
    return () => {
      unsub?.();
    };
  }, []);

  const onMarkAll = async () => {
    await markAllAsRead();
    setItems((prev) => (prev ? prev.map((i) => ({ ...i, is_read: true })) : prev));
  };

  if (items === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground">You have no notifications yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recent</h2>
        <Button variant="ghost" onClick={onMarkAll}>Mark all as read</Button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <NotificationItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}


