import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportStatus } from "@/lib/types";

const REPORT_STATUSES: Set<ReportStatus> = new Set(["pending", "under_review", "action_taken", "dismissed"]);

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
    const statusParam = request.nextUrl.searchParams.get("status");
    const status = (statusParam as ReportStatus | null) ?? null;

    let query = admin
      .from("user_reports")
      .select(
        `
        id,
        category,
        status,
        description,
        evidence_urls,
        created_at,
        updated_at,
        resolution_note,
        reporter_profile:profiles!user_reports_reporter_id_fkey(id, display_name, username, avatar_url),
        reported_profile:profiles!user_reports_reported_id_fkey(id, display_name, username, avatar_url)
      `
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status && REPORT_STATUSES.has(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load reports", error);
      return NextResponse.json({ error: "Unable to load reports" }, { status: 500 });
    }

    return NextResponse.json({ reports: data ?? [] });
  } catch (error) {
    console.error("Unexpected error loading reports", error);
    return NextResponse.json({ error: "Unable to load reports" }, { status: 500 });
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

    const reportId = Number(body?.reportId);
    const status = body?.status as ReportStatus | undefined;
    const resolutionNote = typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : null;

    if (!Number.isFinite(reportId)) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }

    if (!status || !REPORT_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      status,
      resolution_note: resolutionNote,
      resolved_at: ["action_taken", "dismissed"].includes(status) ? new Date().toISOString() : null,
      resolved_by: ["action_taken", "dismissed"].includes(status) ? userId : null,
    };

    const { error } = await admin
      .from("user_reports")
      .update(updatePayload)
      .eq("id", reportId);

    if (error) {
      console.error("Failed to update report", error);
      return NextResponse.json({ error: "Could not update report" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error updating report", error);
    return NextResponse.json({ error: "Could not update report" }, { status: 500 });
  }
}
