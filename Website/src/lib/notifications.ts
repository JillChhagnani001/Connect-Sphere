"use client";

import { createClient } from "@/lib/supabase/client";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "message"
  | "system";

export type NotificationItem = {
  id: number;
  user_id: string; // recipient
  actor_id: string; // who performed the action
  type: NotificationType;
  title: string | null;
  body: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
};

export async function fetchNotifications(limit = 30): Promise<NotificationItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("fetchNotifications: No user found");
    return [];
  }

  console.log("fetchNotifications: Fetching for user:", user.id);

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
        id, user_id, actor_id, type, title, body, metadata, is_read, created_at,
        actor:profiles!notifications_actor_fkey(id, display_name, username, avatar_url)
      `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchNotifications error:", error);
    return [];
  }
  console.log("fetchNotifications: Fetched", data?.length || 0, "notifications");
  return (data as unknown as NotificationItem[]) ?? [];
}

export async function markAllAsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
}

export async function markAsRead(id: number): Promise<void> {
  const supabase = createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  return count ?? 0;
}

export function subscribeToNotifications(
  onInsert: (payload: NotificationItem) => void,
  userId: string
) {
  const supabase = createClient();
  const channel = supabase
    .channel("notifications-feed")
    .on(
      "postgres_changes",
      { 
        event: "INSERT", 
        schema: "public", 
        table: "notifications",
        filter: `user_id=eq.${userId}`
      },
      async (payload: any) => {
        const row = payload.new as any;
        // Optionally fetch actor profile for richer payload
        try {
          const { data } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .eq("id", row.actor_id)
            .single();
          onInsert({ ...row, actor: data } as NotificationItem);
        } catch {
          onInsert(row as NotificationItem);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


