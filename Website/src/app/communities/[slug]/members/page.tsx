import { AppShell } from "@/components/app-shell";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import type { CommunityMember } from "@/lib/types";
import { CommunityMembersManager } from "@/components/communities/community-members-manager";

export default async function CommunityMembersPage({ params }: { params: { slug: string } }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', params.slug)
    .single();
  if (!community) notFound();

  const { data: membership } = await supabase
    .from('community_members')
    .select('role, status')
    .eq('community_id', community.id)
    .eq('user_id', user.id)
    .single();

  const { data: members } = await supabase
    .from('community_members')
    .select('*, user:profiles(id, display_name, username, avatar_url)')
    .eq('community_id', community.id)
    .eq('status', 'active');

  // Sort: owner > co_owner > admin > moderator > member, and then by joined_at desc
  const roleOrder: Record<string, number> = { owner: 0, co_owner: 1, admin: 2, moderator: 3, member: 4 };
  const sorted = (members || []).slice().sort((a: any, b: any) => {
    const ra = roleOrder[a.role] ?? 99;
    const rb = roleOrder[b.role] ?? 99;
    if (ra !== rb) return ra - rb;
    return (new Date(b.joined_at || 0).getTime()) - (new Date(a.joined_at || 0).getTime());
  }) as CommunityMember[];

  const viewerRole: CommunityMember['role'] | null =
    community.owner_id === user.id ? 'owner' : (membership?.status === 'active' ? membership.role : null);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Members of {community.name}</h1>
          <Link href={`/communities/${community.slug}`} className="text-sm text-muted-foreground hover:underline">Back to community</Link>
        </div>

        <Card className="p-4">
          <CommunityMembersManager
            members={sorted}
            communityId={community.id}
            viewerRole={viewerRole}
            viewerId={user.id}
          />
        </Card>
      </div>
    </AppShell>
  );
}
