"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function formatBanLiftDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

type BannedNoticeProps = {
  reason?: string | null;
  bannedUntil?: string | null;
  title?: string;
  description?: string;
  className?: string;
};

export function BannedNotice({
  reason,
  bannedUntil,
  title = "Account Suspended",
  description = "You can't use this account right now because it was suspended by our moderation team.",
  className,
}: BannedNoticeProps) {
  const router = useRouter();
  const supabase = createClient();

  const liftDate = formatBanLiftDate(bannedUntil);
  const suspensionSummary = liftDate
    ? `Your access is scheduled to be restored on ${liftDate}.`
    : "This suspension is currently indefinite.";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center ${className ?? ""}`.trim()}
    >
      <ShieldAlert className="h-12 w-12 text-destructive" aria-hidden />
      <div className="space-y-3 max-w-lg">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Account access is restricted.</p>
          {reason ? <p className="mt-1">Reason: {reason}</p> : null}
          <p className="mt-1">{suspensionSummary}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Sign out to switch accounts or reach out to support if you believe this action was taken in error.
        </p>
        <div className="pt-2">
          <Button className="w-full sm:w-auto" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
