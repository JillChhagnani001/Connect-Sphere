"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type UseRealtimeOptions = {
  currentUserId: string | null | undefined;
  onConversationAdded?: () => void;
  onMessageInserted?: (payload: any) => void;
};

/**
 * Subscribes to Supabase Realtime streams for:
 * - conversation_participants INSERTs for the current user (new chats)
 * - messages INSERTs (new messages in any conversation)
 *
 * This keeps the UI updated without any manual refresh, similar to Instagram DMs.
 */
export function useRealtime({ currentUserId, onConversationAdded, onMessageInserted }: UseRealtimeOptions) {
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();

    const conversationChannel = supabase
      .channel(`cp-stream-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants", filter: `user_id=eq.${currentUserId}` },
        () => {
          onConversationAdded?.();
        }
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`messages-stream-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          onMessageInserted?.(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [currentUserId, onConversationAdded, onMessageInserted]);
}


