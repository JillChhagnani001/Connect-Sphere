"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NotificationItem as Notification, markAsRead } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";

const NOTIFICATIONS_REFRESH_EVENT = "notifications:refresh";

const notifyUnreadRefresh = () => {
  if (typeof globalThis !== "undefined" && globalThis.window) {
    globalThis.window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
  }
};

export function NotificationItem({ item }: Readonly<{ item: Notification }>) {
  const [isRead, setIsRead] = useState(item.is_read);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const onMarkRead = async () => {
    if (isRead) return;
    await markAsRead(item.id);
    setIsRead(true);
    notifyUnreadRefresh();
  };

  // Check if this is a collaboration invite
  const isCollab = !!item.metadata?.invite_id;

  useEffect(() => {
    setIsRead(item.is_read);
  }, [item.is_read]);

  const handleAction = async (action: 'accept' | 'decline') => {
    setIsLoading(true);
    try {
      const rpc = action === 'accept' ? 'accept_collab_invite' : 'decline_collab_invite';
      const { error } = await supabase.rpc(rpc, { invite_id: item.metadata?.invite_id });
      
      if (error) throw error;
      
      setStatus(action === 'accept' ? 'accepted' : 'declined');
      toast({ title: action === 'accept' ? "Invitation accepted" : "Invitation declined" });
      onMarkRead(); // Mark as read after acting on it
    } catch (error: any) {
      console.error("RPC Error:", error);
      toast({ 
        title: "Action failed", 
        description: error.message || "Please try again.",
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn("p-3 flex items-start gap-3 transition-colors", isRead ? "bg-background" : "bg-muted/40")}>
      <Avatar className="h-10 w-10 mt-1">
        <AvatarImage src={item.actor?.avatar_url ?? undefined} />
        <AvatarFallback>{item.actor?.display_name?.charAt(0) ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex justify-between items-start">
          <div className="text-sm">
            <span className="font-semibold">{item.actor?.display_name ?? 'Someone'}</span>{" "}
            <span className="text-muted-foreground">{item.title}</span>
          </div>
          {!isRead && !isCollab && (
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onMarkRead} title="Mark as read">
               <div className="h-2 w-2 bg-blue-500 rounded-full" />
               <span className="sr-only">Mark as read</span>
            </Button>
          )}
        </div>
        {item.body && <div className="text-sm text-muted-foreground">{item.body}</div>}
        
        {/* Collab Buttons: Show if pending, EVEN IF READ */}
        {isCollab && status === 'pending' && (
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="h-7 px-3" onClick={() => handleAction('accept')} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Accept</>}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-3" onClick={() => handleAction('decline')} disabled={isLoading}>
              <X className="h-3 w-3 mr-1" /> Decline
            </Button>
          </div>
        )}

        {/* Collab Status AFTER acting */}
        {isCollab && status !== 'pending' && (
          <div className={`text-xs mt-2 flex items-center font-medium ${status === 'accepted' ? 'text-green-600' : 'text-red-600'}`}>
            {status === 'accepted' ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
            {status === 'accepted' ? 'Accepted' : 'Declined'}
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-1">{new Date(item.created_at).toLocaleString()}</div>
      </div>
    </Card>
  );
}