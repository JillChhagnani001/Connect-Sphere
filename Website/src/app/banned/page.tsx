import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { BannedNotice } from "@/components/banned-notice";

export default async function BannedPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/banned");
  }

  const userId = user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("ban_reason, banned_until")
    .eq("id", userId)
    .maybeSingle();

  const banReason = profile?.ban_reason ?? null;
  const bannedUntil = profile?.banned_until ?? null;
  const isBanActive = Boolean(banReason) && (!bannedUntil || new Date(bannedUntil).getTime() > Date.now());

  if (!isBanActive) {
    redirect("/feed");
  }

  return (
    <main className="min-h-screen bg-muted/40 px-6 py-10">
      <BannedNotice reason={banReason} bannedUntil={bannedUntil} className="max-w-2xl mx-auto" />
    </main>
  );
}
