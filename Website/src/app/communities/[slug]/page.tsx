import { AppShell } from "@/components/app-shell";
import { CommunityPostCard } from "@/components/communities/community-post-card";
import { CreateCommunityPost } from "@/components/communities/create-community-post";
import { CommunityMembersList } from "@/components/communities/community-members-list";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { Community, CommunityPost, CommunityMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Users, IndianRupee, Crown, Calendar } from "lucide-react";
import { joinCommunity, leaveCommunity } from "@/app/communities/actions";
import { CommunityActions } from "@/components/communities/community-actions";
import Image from "next/image";

interface CommunityPageProps {
  params: { slug: string };
}

export default async function CommunityPage({ params }: CommunityPageProps) {
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

  // Fetch community
  const { data: community, error: communityError } = await supabase
    .from('communities')
    .select('*, owner:profiles(id, username, display_name, avatar_url)')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single();

  if (communityError || !community) {
    notFound();
  }

  // Check if user is a member
  const { data: membership } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', community.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  const isMember = !!membership;
  const memberRole = membership?.role || (community.owner_id === user.id ? 'owner' : null);
  const isPremiumMember = isMember && community.membership_type === 'paid' && membership.status === 'active';
  const canCreatePosts = memberRole === 'owner' || memberRole === 'co_owner';
  const canManageRoles = community.owner_id === user.id;

  // Fetch posts (only if member)
  const postsQuery = supabase
    .from('community_posts')
    .select('*, author:profiles(id, username, display_name, avatar_url)')
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Check user's likes for posts
  const { data: userLikes } = isMember
    ? await supabase
        .from('community_post_likes')
        .select('post_id')
        .eq('user_id', user.id)
    : { data: null };

  const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);

  const { data: posts } = isMember ? await postsQuery : { data: null };

  // Attach like status to posts
  const postsWithLikes = posts?.map((post: any) => ({
    ...post,
    is_liked: likedPostIds.has(post.id),
  })) || [];

  // Fetch members
  const { data: members } = await supabase
    .from('community_members')
    .select('*, user:profiles(id, username, display_name, avatar_url)')
    .eq('community_id', community.id)
    .eq('status', 'active')
    .order('role', { ascending: true })
    .order('joined_at', { ascending: false })
    .limit(50);

  const memberCount = members?.length ?? 0;

  // Get user profile
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Community Header */}
        <Card className="overflow-hidden">
          {community.cover_image_url && (
            <div className="relative h-48 w-full">
              <Image
                src={community.cover_image_url}
                alt={community.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 border-4 border-background">
                <AvatarImage src={community.avatar_url || undefined} alt={community.name} />
                <AvatarFallback className="text-2xl">{community.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold">{community.name}</h1>
                    {community.description && (
                      <p className="text-muted-foreground mt-2">{community.description}</p>
                    )}
                  </div>
                  <CommunityActions
                    community={community as unknown as Community}
                    isMember={isMember}
                    isOwner={community.owner_id === user.id}
                  />
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{memberCount} members</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{community.post_count} posts</span>
                  </div>
                  {community.membership_type === 'paid' && (
                    <Badge variant="secondary" className="gap-1">
                      <IndianRupee className="h-3 w-3" />
                      <span>₹{community.price ? community.price.toFixed(0) : '0'}</span>
                    </Badge>
                  )}
                  {isPremiumMember && (
                    <Badge variant="default" className="gap-1">
                      <Crown className="h-3 w-3" />
                      <span>Premium Member</span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {isMember ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <CreateCommunityPost
                communityId={community.id}
                canPost={canCreatePosts}
                userProfile={userProfile || undefined}
              />
              <div className="space-y-4">
                {postsWithLikes.length > 0 ? (
                  postsWithLikes.map((post: any) => (
                    <CommunityPostCard
                      key={post.id}
                      post={post as unknown as CommunityPost}
                      communityId={community.id}
                      isPremiumMember={isPremiumMember}
                    />
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg">No posts yet</p>
                    <p className="text-sm mt-2">Be the first to share something!</p>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-1">
              <CommunityMembersList
                members={(members as unknown as CommunityMember[]) || []}
                communityId={community.id}
                canManageRoles={canManageRoles}
              />
            </div>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Join {community.name}</h2>
            <p className="text-muted-foreground mb-6">
              {community.membership_type === 'paid'
                ? `Join this community for ₹${community.price ? community.price.toFixed(0) : '0'} to access exclusive content and discussions.`
                : 'Join this community to access posts and discussions.'}
            </p>
            <CommunityActions
              community={community as unknown as Community}
              isMember={false}
              isOwner={false}
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}

