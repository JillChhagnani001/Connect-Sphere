import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

function buildEnrichedConversation(raw: any, currentUserId: string) {
  const participants = (raw.participants || []).map((entry: any) => entry.profile);
  const otherParticipant = participants.find((profile: any) => profile?.id !== currentUserId) ?? null;

  return {
    id: raw.id,
    created_at: raw.created_at,
    participants: { data: participants },
    last_message: raw.last_message?.[0] ?? null,
    other_participant: otherParticipant,
    unread_count: 0,
  };
}

export async function POST(request: Request) {
  try {
    const { targetUserId } = await request.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Cannot start a conversation with yourself" }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: currentRows, error: currentError } = await admin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (currentError) {
      throw currentError;
    }

    const { data: targetRows, error: targetError } = await admin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", targetUserId);

    if (targetError) {
      throw targetError;
    }

    const currentIds = new Set((currentRows ?? []).map((row) => row.conversation_id));
    const sharedRow = (targetRows ?? []).find((row) => currentIds.has(row.conversation_id));

    let conversationId = sharedRow?.conversation_id as number | undefined;
    let created = false;

    if (!conversationId) {
      const { data: newConversation, error: createConversationError } = await admin
        .from("conversations")
        .insert({})
        .select()
        .single();

      if (createConversationError) {
        throw createConversationError;
      }

      conversationId = newConversation.id;

      const { error: participantsError } = await admin
        .from("conversation_participants")
        .insert([
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: targetUserId },
        ]);

      if (participantsError) {
        throw participantsError;
      }

      created = true;
    }

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select(`
        id,
        created_at,
        participants:conversation_participants(
          profile:profiles!conversation_participants_user_id_fkey(id, display_name, username, avatar_url)
        ),
        last_message:messages(
          id,
          content,
          created_at,
          sender:profiles!messages_sender_fkey(id, display_name, username, avatar_url)
        )
      `)
      .eq("id", conversationId)
      .single();

    if (conversationError) {
      throw conversationError;
    }

    return NextResponse.json({
      conversation: buildEnrichedConversation(conversation, user.id),
      created,
    });
  } catch (error: any) {
    console.error("Failed to open or create conversation", error);
    const message = error?.message ?? "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
