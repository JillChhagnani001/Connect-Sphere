import { Suspense } from "react";
import { ModeratorDashboard } from "@/components/moderation/moderator-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function ModerationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Moderator Console</h1>
        <p className="mt-2 text-muted-foreground">
          Review new reports, apply account restrictions, and keep the community safe.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <ModeratorDashboard />
      </Suspense>
    </div>
  );
}
