"use client";

import { useEffect } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type ChangePayload = RealtimePostgresInsertPayload<Record<string, unknown>>;

type UseRealtimeOptions = {
  currentUserId?: string | null;
  onConversationAdded?: (payload: ChangePayload) => void;
  onMessageInserted?: (payload: ChangePayload) => void;
  onMessageUpdated?: (payload: ChangePayload) => void;
};

/**
 * Small helper hook that wires the Supabase realtime feed for chat conversations.
 * It keeps the API surface focused on the two events the UI cares about today:
 *  - a new conversation participant entry for the current user (new chat)
 *  - a new message insert (updates previews and message streams)
 */
export function useRealtime(options: UseRealtimeOptions = {}): void {
  const { currentUserId, onConversationAdded, onMessageInserted, onMessageUpdated } = options;

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`chat-realtime-${currentUserId}`);

    if (onConversationAdded) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          onConversationAdded(payload as ChangePayload);
        }
      );
    }

    if (onMessageInserted) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          onMessageInserted(payload as ChangePayload);
        }
      );
    }

    if (onMessageUpdated) {
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          onMessageUpdated(payload as ChangePayload);
        }
      );
    }

    const subscription = channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Supabase realtime channel error for chat feed");
      }
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [currentUserId, onConversationAdded, onMessageInserted, onMessageUpdated]);
}
