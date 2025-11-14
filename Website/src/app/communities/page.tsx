import { AppShell } from "@/components/app-shell";
import { CommunityCard } from "@/components/communities/community-card";
import { CreateCommunityForm } from "@/components/communities/create-community-form";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { CommunitiesList } from "@/components/communities/communities-list";

export default async function CommunitiesPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1) Fetch all communities (base fields only)
  const { data: rawCommunities } = await supabase
    .from('communities')
    .select(`id, name, slug, description, avatar_url, cover_image_url, membership_type, price, is_active, owner:profiles(id, username, display_name, avatar_url)`) 
    .order('created_at', { ascending: false });

  // 2) Exact member counts (only active memberships)
  const { data: memberRows } = await supabase
    .from('community_members')
    .select('community_id')
    .eq('status', 'active');
  const memberCountMap = new Map<number, number>();
  for (const row of memberRows || []) {
    const id = row.community_id as number;
    memberCountMap.set(id, (memberCountMap.get(id) || 0) + 1);
  }

  // 3) Exact post counts
  const { data: postRows } = await supabase
    .from('community_posts')
    .select('community_id');
  const postCountMap = new Map<number, number>();
  for (const row of postRows || []) {
    const id = row.community_id as number;
    postCountMap.set(id, (postCountMap.get(id) || 0) + 1);
  }

  // 4) Merge accurate counts into communities
  const communities = (rawCommunities || []).map((c: any) => ({
    ...c,
    member_count: memberCountMap.get(c.id) || 0,
    post_count: postCountMap.get(c.id) || 0,
  }));

  // Fetch user's memberships
  const { data: memberships } = await supabase
    .from('community_members')
    .select('community_id, status')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const memberCommunityIds = new Set(
    memberships?.map((m) => m.community_id) || []
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Communities</h1>
            <p className="text-muted-foreground mt-1">
              Discover and join communities to connect with like-minded people
            </p>
          </div>
          <CreateCommunityForm />
        </div>

        <CommunitiesList
          communities={communities || []}
          memberCommunityIds={memberCommunityIds}
        />
      </div>
    </AppShell>
  );
}

