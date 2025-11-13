import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileSummary = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ConversationSummary = {
  id: number;
  created_at: string;
  participants: { data: ProfileSummary[] };
  last_message: Record<string, unknown> | null;
  unread_count: number;
  other_participant: ProfileSummary;
  is_blocked_by_me: boolean;
  has_blocked_me: boolean;
};

type BlockSets = {
  blocked: Set<string>;
  blockedBy: Set<string>;
};

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getMessageTimestamp(message: Record<string, unknown> | null | undefined): number {
  if (!message) {
    return 0;
  }

  const createdAt = (message as { created_at?: string | null }).created_at;
  return createdAt ? new Date(createdAt).getTime() : 0;
}

async function fetchConversationRows(admin: SupabaseClient, conversationIds: number[]) {
  const { data, error } = await admin
    .from("conversations")
    .select("id, created_at")
    .in("id", conversationIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<{ id: number; created_at: string }>;
}

async function fetchParticipantsMap(admin: SupabaseClient, conversationIds: number[]) {
  const { data, error } = await admin
    .from("conversation_participants")
    .select(
      "conversation_id, profile:profiles!conversation_participants_user_id_fkey(id, display_name, username, avatar_url)"
    )
    .in("conversation_id", conversationIds);

  if (error) {
    throw error;
  }

  const participantsByConversation = new Map<number, Map<string, ProfileSummary>>();

  for (const row of data ?? []) {
    const entry = row as {
      conversation_id: number;
      profile: ProfileSummary | ProfileSummary[] | null;
    };

    if (!participantsByConversation.has(entry.conversation_id)) {
      participantsByConversation.set(entry.conversation_id, new Map());
    }

    const list: ProfileSummary[] = [];

    if (Array.isArray(entry.profile)) {
      list.push(...entry.profile);
    } else if (entry.profile) {
      list.push(entry.profile);
    }

    for (const profile of list) {
      participantsByConversation.get(entry.conversation_id)!.set(profile.id, profile);
    }
  }

  return participantsByConversation;
}

async function fetchLastMessageMap(admin: SupabaseClient, conversationIds: number[]) {
  const lastMessageMap = new Map<number, Record<string, unknown>>();

  await Promise.all(
    conversationIds.map(async (conversationId) => {
      const { data, error } = await admin
        .from("messages")
        .select(
          "id, conversation_id, content, image_url, created_at, deleted_by, deleted_for_everyone, sender:profiles!messages_sender_fkey(id, display_name, username, avatar_url)"
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const typedError = error as { code?: string } | null;
      if (typedError && typedError.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        lastMessageMap.set(conversationId, data as Record<string, unknown>);
      }
    })
  );

  return lastMessageMap;
}

function mergeParticipants(
  base: Map<string, ProfileSummary> | undefined,
  generalFallbacks: ProfileSummary[],
  extras: ProfileSummary[]
): ProfileSummary[] {
  const merged = new Map<string, ProfileSummary>(base ?? new Map());

  const addProfile = (profile?: ProfileSummary) => {
    if (profile && !merged.has(profile.id)) {
      merged.set(profile.id, profile);
    }
  };

  for (const fallback of generalFallbacks) {
    addProfile(fallback);
  }

  for (const extra of extras) {
    addProfile(extra);
  }

  return Array.from(merged.values());
}

function selectOtherParticipant(
  participants: ProfileSummary[],
  currentUserId: string
): ProfileSummary | undefined {
  return participants.find((participant) => participant.id !== currentUserId);
}

function composeSummaries(
  conversationRows: Array<{ id: number; created_at: string }>,
  participantsByConversation: Map<number, Map<string, ProfileSummary>>,
  lastMessageMap: Map<number, Record<string, unknown>>,
  currentUserId: string,
  fallbackProfiles: Record<string, ProfileSummary>,
  conversationFallbacks: Record<number, ProfileSummary[]>,
  blockSets: BlockSets
): ConversationSummary[] {
  const generalFallbacks = Object.values(fallbackProfiles);
  const result: ConversationSummary[] = [];
  const blocked = blockSets.blocked ?? new Set<string>();
  const blockedBy = blockSets.blockedBy ?? new Set<string>();

  for (const row of conversationRows) {
    const participantList = mergeParticipants(
      participantsByConversation.get(row.id),
      generalFallbacks,
      conversationFallbacks[row.id] ?? []
    );

    const otherParticipant = selectOtherParticipant(participantList, currentUserId);

    if (!otherParticipant) {
      continue;
    }

    const isBlockedByMe = blocked.has(otherParticipant.id);
    const hasBlockedMe = blockedBy.has(otherParticipant.id);

    result.push({
      id: row.id,
      created_at: row.created_at,
      participants: { data: participantList },
      last_message: lastMessageMap.get(row.id) ?? null,
      unread_count: 0,
      other_participant: otherParticipant,
      is_blocked_by_me: isBlockedByMe,
      has_blocked_me: hasBlockedMe,
    });
  }

  result.sort((a, b) => {
    const aTime = getMessageTimestamp(a.last_message) || new Date(a.created_at).getTime();
    const bTime = getMessageTimestamp(b.last_message) || new Date(b.created_at).getTime();
    return bTime - aTime;
  });

  return result;
}

async function buildConversationSummaries(
  admin: SupabaseClient,
  conversationIds: number[],
  currentUserId: string,
  fallbackProfiles: Record<string, ProfileSummary> = {},
  conversationFallbacks: Record<number, ProfileSummary[]> = {},
  blockSets?: BlockSets
): Promise<ConversationSummary[]> {
  if (conversationIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(conversationIds)).filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) {
    return [];
  }

  const [conversationRows, participantsByConversation, lastMessageMap] = await Promise.all([
    fetchConversationRows(admin, uniqueIds),
    fetchParticipantsMap(admin, uniqueIds),
    fetchLastMessageMap(admin, uniqueIds),
  ]);

  const effectiveBlockSets = blockSets ?? { blocked: new Set<string>(), blockedBy: new Set<string>() };

  return composeSummaries(
    conversationRows,
    participantsByConversation,
    lastMessageMap,
    currentUserId,
    fallbackProfiles,
    conversationFallbacks,
    effectiveBlockSets
  );
}

async function fetchBlockSets(admin: SupabaseClient, userId: string): Promise<BlockSets> {
  const [{ data: blockedRows, error: blockedError }, { data: blockedByRows, error: blockedByError }] = await Promise.all([
    admin.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    admin.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
  ]);

  if (blockedError) {
    console.error("Failed to load user block list", blockedError);
    throw new RequestError(500, "Unable to load blocks");
  }

  if (blockedByError) {
    console.error("Failed to load users who blocked current user", blockedByError);
    throw new RequestError(500, "Unable to load blocks");
  }

  return {
    blocked: new Set((blockedRows ?? []).map((row) => (row as { blocked_id: string }).blocked_id)),
    blockedBy: new Set((blockedByRows ?? []).map((row) => (row as { blocker_id: string }).blocker_id)),
  };
}

async function deleteConversationRecords(admin: SupabaseClient, conversationId: number) {
  const { error } = await admin.from("conversations").delete().eq("id", conversationId);

  if (error) {
    throw error;
  }
}

async function getProfileOrThrow(
  admin: SupabaseClient,
  userId: string,
  options: { notFoundMessage: string; logContext: string; loadErrorMessage?: string }
): Promise<ProfileSummary> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(`Failed to load profile (${options.logContext})`, error);
    throw new RequestError(500, options.loadErrorMessage ?? "Unable to load profile");
  }

  if (!data) {
    throw new RequestError(404, options.notFoundMessage);
  }

  return data as ProfileSummary;
}

async function findExistingConversationId(
  admin: SupabaseClient,
  currentUserId: string,
  targetUserId: string
) {
  const { data: currentRows, error: currentError } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (currentError) {
    throw currentError;
  }

  if (!currentRows || currentRows.length === 0) {
    return null;
  }

  const { data: overlapRows, error: overlapError } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", targetUserId)
    .in(
      "conversation_id",
      currentRows.map((entry) => entry.conversation_id as number)
    );

  if (overlapError) {
    throw overlapError;
  }

  return overlapRows?.[0]?.conversation_id ?? null;
}

async function createConversation(
  admin: SupabaseClient,
  currentUserId: string,
  targetUserId: string
) {
  const { data, error } = await admin
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const conversationId = data.id as number;

  const { error: participantError } = await admin
    .from("conversation_participants")
    .insert([
      { conversation_id: conversationId, user_id: currentUserId },
      { conversation_id: conversationId, user_id: targetUserId },
    ]);

  if (participantError) {
    throw participantError;
  }

  return conversationId;
}

async function ensureConversation(
  admin: SupabaseClient,
  currentUserId: string,
  targetUserId: string
) {
  const existing = await findExistingConversationId(admin, currentUserId, targetUserId);
  if (existing) {
    return existing;
  }

  return createConversation(admin, currentUserId, targetUserId);
}

async function upsertHiddenAt(
  admin: SupabaseClient,
  conversationId: number,
  userId: string,
  hiddenAt: string | null
) {
  const { error } = await admin
    .from("conversation_participants")
    .update({ hidden_at: hiddenAt })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const targetUserId = (body as { targetUserId?: string })?.targetUserId?.trim();

  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot start a conversation with yourself" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const [blockSets, targetProfile, currentProfile] = await Promise.all([
      fetchBlockSets(admin, user.id),
      getProfileOrThrow(admin, targetUserId, {
        notFoundMessage: "Target user not found",
        logContext: "target profile lookup",
        loadErrorMessage: "Unable to look up target user",
      }),
      getProfileOrThrow(admin, user.id, {
        notFoundMessage: "Profile not found",
        logContext: "current profile lookup",
        loadErrorMessage: "Unable to load profile",
      }),
    ]);

    if (blockSets.blocked.has(targetUserId)) {
      throw new RequestError(403, "You have blocked this user");
    }

    if (blockSets.blockedBy.has(targetUserId)) {
      throw new RequestError(403, "You are blocked by this user");
    }

    const conversationId = await ensureConversation(admin, user.id, targetUserId);
    await upsertHiddenAt(admin, conversationId, user.id, null);

    const [conversation] = await buildConversationSummaries(
      admin,
      [conversationId],
      user.id,
      { [currentProfile.id]: currentProfile },
      { [conversationId]: [targetProfile] },
      blockSets
    );

    if (!conversation) {
      throw new RequestError(404, "Conversation not found");
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create or fetch conversation", error);
    return NextResponse.json({ error: "Could not open conversation." }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const [currentProfile, blockSets] = await Promise.all([
      getProfileOrThrow(admin, user.id, {
        notFoundMessage: "Profile not found",
        logContext: "current profile lookup",
        loadErrorMessage: "Unable to load profile",
      }),
      fetchBlockSets(admin, user.id),
    ]);

    const { data: participantRows, error: participantError } = await admin
      .from("conversation_participants")
      .select("conversation_id, hidden_at")
      .eq("user_id", user.id);

    if (participantError) {
      console.error("Failed to load conversations", participantError);
      throw new RequestError(500, "Could not load conversations");
    }

    const conversationIds = (participantRows ?? []).map((row) => row.conversation_id as number);
    const hiddenMap = new Map<number, string | null>();
    for (const row of participantRows ?? []) {
      const entry = row as { conversation_id: number; hidden_at: string | null };
      hiddenMap.set(entry.conversation_id, entry.hidden_at ?? null);
    }

    const conversations = await buildConversationSummaries(
      admin,
      conversationIds,
      user.id,
      { [currentProfile.id]: currentProfile },
      undefined,
      blockSets
    );

    const visible: ConversationSummary[] = [];
    const toReveal: number[] = [];

    for (const convo of conversations) {
      const hiddenAt = hiddenMap.get(convo.id);
      if (!hiddenAt) {
        visible.push(convo);
        continue;
      }

      const hiddenTime = new Date(hiddenAt).getTime();
      const lastMessageTime = getMessageTimestamp(convo.last_message);

      if (lastMessageTime > hiddenTime) {
        visible.push(convo);
        toReveal.push(convo.id);
      }
    }

    if (toReveal.length > 0) {
      await admin
        .from("conversation_participants")
        .update({ hidden_at: null })
        .eq("user_id", user.id)
        .in("conversation_id", toReveal);
    }

    return NextResponse.json({ conversations: visible });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch conversations", error);
    return NextResponse.json({ error: "Could not load conversations" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { conversationId: rawConversationId, action } = body as {
    conversationId?: number | string;
    action?: "hide" | "unhide";
  };

  const conversationId = Number(rawConversationId);

  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const { data: participantRow, error: participantError } = await admin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      console.error("Failed to verify conversation participant", participantError);
      throw new RequestError(500, "Unable to update conversation");
    }

    if (!participantRow) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (action === "hide") {
      await upsertHiddenAt(admin, conversationId, user.id, new Date().toISOString());
    } else if (action === "unhide") {
      await upsertHiddenAt(admin, conversationId, user.id, null);
    } else {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update conversation", error);
    return NextResponse.json({ error: "Could not update conversation." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversationIdParam =
    request.nextUrl.searchParams.get("conversationId") ?? request.nextUrl.searchParams.get("id");
  const conversationId = conversationIdParam ? Number.parseInt(conversationIdParam, 10) : Number.NaN;

  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const { data: participantRow, error: participantError } = await admin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      console.error("Failed to verify conversation participant", participantError);
      throw new RequestError(500, "Unable to delete conversation");
    }

    if (!participantRow) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await deleteConversationRecords(admin, conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete conversation", error);
    return NextResponse.json({ error: "Could not delete conversation." }, { status: 500 });
  }
}
