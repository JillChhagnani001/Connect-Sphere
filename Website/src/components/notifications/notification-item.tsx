"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NotificationItem as Notification } from "@/lib/notifications";
import { markAsRead } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function NotificationItem({ item }: { item: Notification }) {
  const [isRead, setIsRead] = useState(item.is_read);

  const onMarkRead = async () => {
    if (isRead) return;
    await markAsRead(item.id);
    setIsRead(true);
  };

  return (
    <Card
      className={cn(
        "p-3 flex items-center gap-3",
        !isRead && "bg-muted/40"
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={item.actor?.avatar_url ?? undefined} />
        <AvatarFallback>
          {item.actor?.display_name?.charAt(0) ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="text-sm font-medium">
          {item.title ?? `${item.type} notification`}
        </div>
        {item.body && (
          <div className="text-sm text-muted-foreground line-clamp-2">
            {item.body}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-1">
          {new Date(item.created_at).toLocaleString()}
        </div>
      </div>
      {!isRead && (
        <Button size="sm" variant="outline" onClick={onMarkRead}>
          Mark as read
        </Button>
      )}
    </Card>
  );
}


