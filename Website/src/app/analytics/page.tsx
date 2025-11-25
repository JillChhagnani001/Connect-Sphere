import { AppShell } from "@/components/app-shell";
import { StatsCard } from "@/components/analytics/stats-card";
import { EngagementChart } from "@/components/analytics/engagement-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Users, Eye, Heart, ShieldAlert, DollarSign } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface EarningsData {
  id: number;
  amount: number;
  currency: string;
  payerName: string;
  payerUsername: string;
  communityName: string;
  paidAt: string | null;
  createdAt: string;
}

interface AnalyticsData {
  totalFollowers: number;
  totalLikes: number;
  totalImpressions: number;
  engagementRate: number;
  totalEarnings: number;
  earningsData: EarningsData[];
  engagementData: Array<{
    name: string;
    likes: number;
    comments: number;
    shares: number;
  }>;
}

async function fetchCommunityEarnings(userId: string): Promise<{ totalEarnings: number; earningsData: EarningsData[] }> {
  const supabase = createServerClient();

  // First, get all communities owned by this user with their prices
  const { data: communities, error: communitiesError } = await supabase
    .from("communities")
    .select("id, name, price, currency")
    .eq("owner_id", userId)
    .not("price", "is", null); // Only paid communities

  if (communitiesError || !communities || communities.length === 0) {
    return { totalEarnings: 0, earningsData: [] };
  }

  const communityIds = communities.map((c) => c.id);
  const communityMap = new Map(
    communities.map((c) => [c.id, { name: c.name, price: Number(c.price || 0), currency: c.currency || "INR" }])
  );

  // Fetch paid memberships from community_members
  // This is the source of truth since payment verification updates this table
  const { data: paidMemberships, error } = await supabase
    .from("community_members")
    .select("id, community_id, user_id, payment_date, payment_status, joined_at")
    .in("community_id", communityIds)
    .eq("payment_status", "paid")
    .order("payment_date", { ascending: false });

  if (error) {
    console.error("Error fetching community earnings:", error);
    return { totalEarnings: 0, earningsData: [] };
  }

  if (!paidMemberships || paidMemberships.length === 0) {
    return { totalEarnings: 0, earningsData: [] };
  }

  // Get unique user IDs to fetch payer profiles
  const userIds = [...new Set(paidMemberships.map((m) => m.user_id))];

  // Fetch payer profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", userIds);

  const profileMap = new Map(
    profiles?.map((p) => [p.id, { display_name: p.display_name, username: p.username }]) || []
  );

  const earningsData: EarningsData[] = [];
  let totalEarnings = 0;

  paidMemberships.forEach((membership: any) => {
    const community = communityMap.get(membership.community_id);
    if (!community) return; // Skip if community not found

    const amount = community.price;
    totalEarnings += amount;

    const payerInfo = profileMap.get(membership.user_id);

    earningsData.push({
      id: membership.id,
      amount: amount,
      currency: community.currency,
      payerName: payerInfo?.display_name || "Unknown",
      payerUsername: payerInfo?.username || "unknown",
      communityName: community.name,
      paidAt: membership.payment_date || membership.joined_at,
      createdAt: membership.joined_at,
    });
  });

  // Sort by paid_at (most recent first)
  earningsData.sort((a, b) => {
    const dateA = new Date(a.paidAt || a.createdAt).getTime();
    const dateB = new Date(b.paidAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  return { totalEarnings, earningsData };
}

async function fetchUserAnalytics(userId: string): Promise<AnalyticsData> {
  const supabase = createServerClient();

  // Fetch follower count
  const { data: profile } = await supabase
    .from("profiles")
    .select("follower_count")
    .eq("id", userId)
    .single();

  const totalFollowers = profile?.follower_count || 0;

  // Fetch all posts for the user
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: posts } = await supabase
    .from("posts")
    .select("like_count, comment_count, share_count, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Calculate total likes across all posts
  const { data: allPosts } = await supabase
    .from("posts")
    .select("like_count, comment_count, share_count")
    .eq("user_id", userId);

  const totalLikes = allPosts?.reduce((sum, post) => sum + (post.like_count || 0), 0) || 0;
  const totalComments = allPosts?.reduce((sum, post) => sum + (post.comment_count || 0), 0) || 0;
  const totalShares = allPosts?.reduce((sum, post) => sum + (post.share_count || 0), 0) || 0;

  // Calculate impressions (estimated: sum of all engagement metrics)
  const totalImpressions = totalLikes + totalComments + totalShares;

  // Calculate engagement rate: (likes + comments + shares) / impressions * 100
  // For a more realistic engagement rate, we'll use follower count as the base
  const totalEngagement = totalLikes + totalComments + totalShares;
  const engagementRate = totalFollowers > 0 
    ? (totalEngagement / (totalFollowers * Math.max(1, allPosts?.length || 1))) * 100 
    : 0;
  

  // Group posts by week for the last 30 days
  const engagementData: Array<{
    name: string;
    likes: number;
    comments: number;
    shares: number;
  }> = [];

  if (posts && posts.length > 0) {
    const weeks: { [key: string]: { likes: number; comments: number; shares: number } } = {};
    
    posts.forEach((post) => {
      const postDate = new Date(post.created_at);
      const weekStart = new Date(postDate);
      weekStart.setDate(postDate.getDate() - postDate.getDay()); // Start of week (Sunday)
      const weekKey = `Week ${Math.floor((Date.now() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1}`;
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = { likes: 0, comments: 0, shares: 0 };
      }
      
      weeks[weekKey].likes += post.like_count || 0;
      weeks[weekKey].comments += post.comment_count || 0;
      weeks[weekKey].shares += post.share_count || 0;
    });

    // Convert to array format
    Object.entries(weeks).forEach(([name, data]) => {
      engagementData.push({ name, ...data });
    });

    // Sort by week number
    engagementData.sort((a, b) => {
      const aNum = parseInt(a.name.replace("Week ", ""));
      const bNum = parseInt(b.name.replace("Week ", ""));
      return aNum - bNum;
    });
  } else {
    // If no posts, show empty weeks
    for (let i = 1; i <= 5; i++) {
      engagementData.push({
        name: `Week ${i}`,
        likes: 0,
        comments: 0,
        shares: 0,
      });
    }
  }

  // Fetch community earnings
  const { totalEarnings, earningsData } = await fetchCommunityEarnings(userId);

  return {
    totalFollowers,
    totalLikes,
    totalImpressions,
    engagementRate,
    totalEarnings,
    earningsData,
    engagementData,
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function formatCurrency(amount: number, currency: string = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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

  // Only show analytics to verified content creators
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

  // Fetch analytics data for the logged-in user only
  const analytics = await fetchUserAnalytics(user.id);

  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatsCard 
            title="Total Followers" 
            value={formatNumber(analytics.totalFollowers)} 
            icon={Users} 
            trend="" 
          />
          <StatsCard 
            title="Impressions" 
            value={formatNumber(analytics.totalImpressions)} 
            icon={Eye} 
            trend="" 
          />
          <StatsCard 
            title="Engagement Rate" 
            value={analytics.engagementRate.toFixed(1) + "%"} 
            icon={Activity} 
            trend="" 
          />
          <StatsCard 
            title="Total Likes" 
            value={formatNumber(analytics.totalLikes)} 
            icon={Heart} 
            trend="" 
          />
          <StatsCard 
            title="Total Earnings" 
            value={formatCurrency(analytics.totalEarnings)} 
            icon={DollarSign} 
            trend="" 
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Post Engagement (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementChart data={analytics.engagementData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Community Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.earningsData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payer</TableHead>
                    <TableHead>Community</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.earningsData.map((earning) => (
                    <TableRow key={earning.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{earning.payerName}</div>
                          <div className="text-sm text-muted-foreground">@{earning.payerUsername}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{earning.communityName}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(earning.amount, earning.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(earning.paidAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No earnings from communities yet. Create paid communities to start earning!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
