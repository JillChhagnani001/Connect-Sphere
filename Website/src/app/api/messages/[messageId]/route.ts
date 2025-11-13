import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type DeleteAction = "delete-for-me" | "delete-for-everyone";

type MessageMetadata = {
  id: number;
  sender: string;
  conversation_id: number;
  deleted_by: string[] | null;
  deleted_for_everyone: boolean;
};

function parseDeleteAction(raw?: string | null): DeleteAction {
  if (raw === "delete-for-me" || raw === "delete-for-everyone") {
    return raw;
  }

  throw new RequestError(400, "Unsupported action");
}

async function getMessageMetadata(admin: ReturnType<typeof createAdminClient>, messageId: number) {
  const { data, error } = await admin
    .from("messages")
    .select("id, sender, conversation_id, deleted_by, deleted_for_everyone")
    .eq("id", messageId)
    .maybeSingle<MessageMetadata>();

  if (error) {
    console.error("Failed to load message", error);
    throw new RequestError(500, "Unable to delete message");
  }

  if (!data) {
    throw new RequestError(404, "Message not found");
  }

  return data;
}

async function ensureParticipant(admin: ReturnType<typeof createAdminClient>, conversationId: number, userId: string) {
  const { data, error } = await admin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify participant", error);
    throw new RequestError(500, "Unable to delete message");
  }

  if (!data) {
    throw new RequestError(403, "You are not a participant of this conversation");
  }
}

function collectDeletedBy(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? [...value] : [];
}

async function deleteForMe(
  admin: ReturnType<typeof createAdminClient>,
  message: MessageMetadata,
  userId: string
) {
  if (message.sender !== userId) {
    throw new RequestError(403, "You can only delete your own messages");
  }

  const deletedBy = collectDeletedBy(message.deleted_by);
  if (deletedBy.includes(userId)) {
    return;
  }

  deletedBy.push(userId);

  const { error } = await admin
    .from("messages")
    .update({ deleted_by: deletedBy })
    .eq("id", message.id);

  if (error) {
    console.error("Failed to mark message as deleted", error);
    throw new RequestError(500, "Unable to delete message");
  }
}

async function deleteForEveryone(
  admin: ReturnType<typeof createAdminClient>,
  message: MessageMetadata,
  userId: string
) {
  if (message.sender !== userId) {
    throw new RequestError(403, "Only the sender can delete for everyone");
  }

  if (message.deleted_for_everyone) {
    return;
  }

  const deletedBy = collectDeletedBy(message.deleted_by);
  if (!deletedBy.includes(userId)) {
    deletedBy.push(userId);
  }

  const { error } = await admin
    .from("messages")
    .update({ deleted_for_everyone: true, deleted_by: deletedBy })
    .eq("id", message.id);

  if (error) {
    console.error("Failed to mark message as deleted for everyone", error);
    throw new RequestError(500, "Unable to delete message");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { messageId: string } }) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messageId = Number(params.messageId);
  if (!Number.isFinite(messageId)) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const action = (body as { action?: string })?.action ?? null;

  const admin = createAdminClient();

  try {
    const deleteAction = parseDeleteAction(action);
    const message = await getMessageMetadata(admin, messageId);

    await ensureParticipant(admin, message.conversation_id, user.id);

    if (deleteAction === "delete-for-me") {
      await deleteForMe(admin, message, user.id);
    } else if (deleteAction === "delete-for-everyone") {
      await deleteForEveryone(admin, message, user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update message", error);
    return NextResponse.json({ error: "Could not update message." }, { status: 500 });
  }
}
