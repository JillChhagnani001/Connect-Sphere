import { AppShell } from "@/components/app-shell";
import { StatsCard } from "@/components/analytics/stats-card";
import { EngagementChart } from "@/components/analytics/engagement-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Eye, Heart, ShieldAlert } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_verified")
    .eq("id", user.id)
    .single();

  if (!profile?.is_verified) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-muted-foreground">
          <ShieldAlert className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Analytics Unavailable</h1>
            <p>You need a verified creator account to access analytics.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Followers" value="12,345" icon={Users} trend="+12% this month" />
          <StatsCard title="Impressions" value="2.1M" icon={Eye} trend="+5.2% this month" />
          <StatsCard title="Engagement Rate" value="3.4%" icon={Activity} trend="-0.5% this month" trendDirection="down" />
          <StatsCard title="Total Likes" value="89.6K" icon={Heart} trend="+21% this month" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Post Engagement (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementChart />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
