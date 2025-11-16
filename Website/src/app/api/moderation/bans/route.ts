import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MinimalProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type RawBan = {
  id: string;
  user_id: string;
  reason: string | null;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by: string | null;
  lift_reason: string | null;
};

async function getModeratorContext() {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_moderator")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_moderator) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }

  return { userId: user.id, admin } as const;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getModeratorContext();
    if ("error" in context) {
      return context.error;
    }

    const { admin } = context;
    const status = request.nextUrl.searchParams.get("status") ?? "active";

    let query = admin
      .from("user_bans")
      .select("id, user_id, reason, created_by, created_at, expires_at, lifted_at, lifted_by, lift_reason")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status === "active") {
      query = query.is("lifted_at", null);
    }

    const { data, error } = await query;

    if (error) {
      const errorMessage = error?.message?.toLowerCase?.() ?? "";
      const errorDetails = typeof error?.details === "string" ? error.details.toLowerCase() : "";
      const missingRelation =
        error?.code === "PGRST100" ||
        error?.code === "PGRST101" ||
        error?.code === "PGRST102" ||
        errorMessage.includes("user_bans") ||
        errorMessage.includes("profiles") ||
        errorDetails.includes("user_bans");

      if (missingRelation) {
        console.warn("Moderation bans setup incomplete", error);
        return NextResponse.json({ bans: [], setupRequired: true });
      }

      console.error("Failed to load bans", error);
      return NextResponse.json({ error: "Unable to load bans" }, { status: 500 });
    }

    let bans = (data as RawBan[]) ?? [];

    if (status === "active") {
      const now = Date.now();
      bans = bans.filter((ban) => !ban.expires_at || new Date(ban.expires_at).getTime() > now);
    }

    const userIds = Array.from(new Set(bans.map((ban) => ban.user_id).filter(Boolean)));
    let profilesById: Record<string, MinimalProfile> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        const errorMessage = profilesError?.message?.toLowerCase?.() ?? "";
        const errorDetails = typeof profilesError?.details === "string" ? profilesError.details.toLowerCase() : "";
        const missingRelation =
          profilesError?.code === "PGRST100" ||
          profilesError?.code === "PGRST101" ||
          profilesError?.code === "PGRST102" ||
          errorMessage.includes("profiles") ||
          errorDetails.includes("profiles");

        if (missingRelation) {
          console.warn("Profiles table not accessible while loading bans", profilesError);
          return NextResponse.json({ bans: [], setupRequired: true });
        }

        console.error("Failed to load ban profiles", profilesError);
      } else if (profiles) {
        profilesById = Object.fromEntries((profiles as MinimalProfile[]).map((profile) => [profile.id, profile]));
      }
    }

    const bansWithProfiles = bans.map((ban) => ({
      ...ban,
      user_profile: profilesById[ban.user_id] ?? null,
    }));

    return NextResponse.json({ bans: bansWithProfiles });
  } catch (error) {
    console.error("Unexpected error loading bans", error);
    return NextResponse.json({ error: "Unable to load bans" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getModeratorContext();
    if ("error" in context) {
      return context.error;
    }

    const { userId, admin } = context;
    const body = await request.json().catch(() => ({}));

    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const reason = typeof body?.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;
    const expiresAtRaw = typeof body?.expiresAt === "string" ? body.expiresAt : null;

    if (!targetUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    let expiresAt: string | null = null;
    if (expiresAtRaw) {
      const expiresDate = new Date(expiresAtRaw);
      if (Number.isNaN(expiresDate.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
      }
      expiresAt = expiresDate.toISOString();
    }

    await admin
      .from("user_bans")
      .update({ lifted_at: new Date().toISOString(), lift_reason: "Superseded by moderator", lifted_by: userId })
      .eq("user_id", targetUserId)
      .is("lifted_at", null);

    const insertResult = await admin.from("user_bans").insert({
      user_id: targetUserId,
      reason,
      expires_at: expiresAt,
      created_by: userId,
    });

    if (insertResult.error) {
      console.error("Failed to create ban", insertResult.error);
      return NextResponse.json({ error: "Could not create ban" }, { status: 500 });
    }

    const { error: refreshError } = await admin.rpc("refresh_profile_ban_state", { target_user: targetUserId });

    if (refreshError) {
      console.error("Failed to refresh ban state after issuing ban", refreshError);
      return NextResponse.json({ error: "Could not update user ban state" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error creating ban", error);
    return NextResponse.json({ error: "Could not create ban" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getModeratorContext();
    if ("error" in context) {
      return context.error;
    }

    const { userId, admin } = context;
    const body = await request.json().catch(() => ({}));

    const banId = typeof body?.banId === "string" ? body.banId : null;
    const liftReason = typeof body?.liftReason === "string" && body.liftReason.trim().length > 0 ? body.liftReason.trim() : "Lifted by moderator";

    if (!banId) {
      return NextResponse.json({ error: "banId is required" }, { status: 400 });
    }

    const { data: updatedBan, error } = await admin
      .from("user_bans")
      .update({ lifted_at: new Date().toISOString(), lifted_by: userId, lift_reason: liftReason })
      .eq("id", banId)
      .is("lifted_at", null)
      .select("user_id")
      .maybeSingle();

    if (error) {
      console.error("Failed to lift ban", error);
      return NextResponse.json({ error: "Could not lift ban" }, { status: 500 });
    }

    if (updatedBan?.user_id) {
      const { error: refreshError } = await admin.rpc("refresh_profile_ban_state", { target_user: updatedBan.user_id });

      if (refreshError) {
        console.error("Failed to refresh ban state after lifting ban", refreshError);
        return NextResponse.json({ error: "Could not update user ban state" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error lifting ban", error);
    return NextResponse.json({ error: "Could not lift ban" }, { status: 500 });
  }
}
