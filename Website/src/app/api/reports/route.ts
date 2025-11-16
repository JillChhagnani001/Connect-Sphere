import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const REPORT_CATEGORIES = new Set<
  | "harassment_or_bullying"
  | "hate_or_violence"
  | "sexual_or_graphic_content"
  | "fraud_or_scam"
  | "impersonation"
  | "spam"
  | "other"
>([
  "harassment_or_bullying",
  "hate_or_violence",
  "sexual_or_graphic_content",
  "fraud_or_scam",
  "impersonation",
  "spam",
  "other",
]);

class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
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

  const {
    reportedUserId,
    category,
    description,
    evidenceUrls,
  } = body as {
    reportedUserId?: string;
    category?: string;
    description?: string;
    evidenceUrls?: string[];
  };

  if (!reportedUserId) {
    return NextResponse.json({ error: "reportedUserId is required" }, { status: 400 });
  }

  if (reportedUserId === user.id) {
    return NextResponse.json({ error: "You cannot report yourself" }, { status: 400 });
  }

  if (!category || !REPORT_CATEGORIES.has(category as never)) {
    return NextResponse.json({ error: "Invalid report category" }, { status: 400 });
  }

  const trimmedDescription = description?.trim();
  const normalizedEvidence = Array.isArray(evidenceUrls)
    ? evidenceUrls
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];

  const admin = createAdminClient();

  try {
    const { data: reportedProfile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", reportedUserId)
      .maybeSingle();

    if (profileError) {
      throw new RequestError(500, "Unable to verify reported user");
    }

    if (!reportedProfile) {
      throw new RequestError(404, "Reported user not found");
    }

    const { error: insertError } = await admin.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: reportedUserId,
      category,
      description: trimmedDescription ?? null,
      evidence_urls: normalizedEvidence,
    });

    if (insertError) {
      console.error("Failed to submit report", insertError);
      throw new RequestError(500, "Could not submit report");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Unexpected error creating report", error);
    return NextResponse.json({ error: "Could not submit report" }, { status: 500 });
  }
}
