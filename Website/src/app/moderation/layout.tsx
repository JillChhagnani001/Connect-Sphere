import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ModerationLayout({ children }: { children: ReactNode }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/moderation");
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_moderator")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load moderator profile", error);
    redirect("/");
  }

  if (!profile?.is_moderator) {
    redirect("/");
  }

  return <>{children}</>;
}
