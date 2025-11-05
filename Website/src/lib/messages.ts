import { createClient } from "@/lib/supabase/client";

export type Conversation = {
  id: number;
  is_group: boolean;
  title: string | null;
  created_at: string;
  last_message?: Message | null;
  participants?: Array<{ user_id: string }>; // lightweight
};

export type Message = {
  id: number;
  conversation_id: number;
  sender_id: string;
  content: string;
  created_at: string;
};

export async function createOrGetConversationWith(userId: string): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Try to find an existing 1:1 conversation between the two users
  const { data: existing } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (existing && existing.length > 0) {
    const convIds = existing.map((e) => e.conversation_id);
    const { data: overlap } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("user_id", userId);
    if (overlap && overlap.length > 0) {
      return overlap[0].conversation_id as number;
    }
  }

  // Create a new conversation and add both users
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ is_group: false })
    .select("id")
    .single();
  if (convErr) throw convErr;

  const { error: partErr } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: userId },
    ]);
  if (partErr) throw partErr;

  return conv.id as number;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get conversations where current user participates
  const { data: convIds } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (!convIds || convIds.length === 0) return [];
  const ids = convIds.map((c) => c.conversation_id);

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, is_group, title, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });

  return conversations ?? [];
}

export async function fetchMessages(conversationId: number, limit = 50): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(conversationId: number, content: string): Promise<Message> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Empty message");

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, content: trimmed, sender_id: user.id })
    .select("id, conversation_id, sender_id, content, created_at")
    .single();
  if (error) throw error;
  return data as Message;
}

export function subscribeToMessages(conversationId: number, onInsert: (m: Message) => void) {
  const supabase = createClient();
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload: any) => {
      onInsert(payload.new as Message);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


