import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function ensureTargetExists(admin: SupabaseClient, targetUserId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load target profile for block", error);
    throw new RequestError(500, "Unable to block user");
  }

  if (!data) {
    throw new RequestError(404, "User not found");
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
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    await ensureTargetExists(admin, targetUserId);

    const { error: upsertError } = await admin
      .from("user_blocks")
      .upsert({ blocker_id: user.id, blocked_id: targetUserId }, { onConflict: "blocker_id,blocked_id" });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to block user", error);
    return NextResponse.json({ error: "Could not block user." }, { status: 500 });
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

  const targetUserId = request.nextUrl.searchParams.get("targetUserId")?.trim();

  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot unblock yourself" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: existingRow, error: selectError } = await admin
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
      .maybeSingle();

    if (selectError) {
      console.error("Failed to look up block entry", selectError);
      throw new RequestError(500, "Unable to unblock user");
    }

    if (!existingRow) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const { error: deleteError } = await admin
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to unblock user", error);
    return NextResponse.json({ error: "Could not unblock user." }, { status: 500 });
  }
}
