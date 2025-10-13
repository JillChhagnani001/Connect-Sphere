import { AppShell } from "@/components/app-shell";
import { StatsCard } from "@/components/analytics/stats-card";
import { EngagementChart } from "@/components/analytics/engagement-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Eye, Heart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
