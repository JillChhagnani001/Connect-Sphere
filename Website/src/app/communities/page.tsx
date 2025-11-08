import { AppShell } from "@/components/app-shell";
import { CommunityCard } from "@/components/communities/community-card";
import { CreateCommunityForm } from "@/components/communities/create-community-form";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Community } from "@/lib/types";
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

  // Fetch all communities with owner info
  const { data: communities } = await supabase
    .from('communities')
    .select('*, owner:profiles(id, username, display_name, avatar_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

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
          communities={(communities as unknown as Community[]) || []}
          memberCommunityIds={memberCommunityIds}
        />
      </div>
    </AppShell>
  );
}

