import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileContentTabs } from "@/components/profile/profile-content-tabs";
import { Lock } from "lucide-react";
import type { Post } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const POSTS_PAGE_LIMIT = 20;

type ProfilePageProps = Readonly<{
  params: Readonly<{ username: string }>;
}>;

export default async function ProfilePage({ params }: ProfilePageProps) {
  const supabase = createServerClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();

  // 1. Fetch profile and privacy settings
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      *,
      privacy_settings (
        profile_visibility,
        allow_follow_requests,
        show_followers,
        show_following
      )
    `)
    .eq("username", params.username)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    notFound();
  }

  const settings = profile.privacy_settings;
  const isProfilePrivate = (settings?.profile_visibility ?? "public") === "private";
  const requiresFollowRequest = (settings?.profile_visibility ?? "public") !== "public";
  const isOwner = authUser?.id === profile.id;

  // 2. Fetch follow status and mutual followers in parallel
  const [isFollowing, mutualResult] = await Promise.all([
    checkIfFollowing(supabase, authUser?.id, profile.id, isOwner),
    authUser?.id && !isOwner
      ? supabase.rpc("get_mutual_count", { viewer_id: authUser.id, target_id: profile.id })
      : Promise.resolve({ data: 0 }),
  ]);

  const mutualFollowersCount = (mutualResult as any)?.data ?? 0;

  // 3. Determine access rights
  const canViewPosts = !isProfilePrivate || isOwner || isFollowing;
  const canViewFollowers = isOwner || ((settings?.show_followers ?? true) && (!isProfilePrivate || isFollowing));
  const canViewFollowing = isOwner || ((settings?.show_following ?? true) && (!isProfilePrivate || isFollowing));

  // 4. Fetch posts
  const { content: allContent, hasMore, totalCount } = await fetchUserContent(
    supabase,
    profile.id,
    canViewPosts,
    POSTS_PAGE_LIMIT
  );

  const posts = allContent.filter(p => p.media && p.media.length > 0);
  const threads = allContent.filter(p => !p.media || p.media.length === 0);
  const postsCount = totalCount;

  const userProfile = {
    ...profile,
    postsCount: postsCount ?? 0,
    followersCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    is_private: isProfilePrivate,
    isVerified: Boolean(profile.is_verified),
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader
          user={userProfile}
          currentUserId={authUser?.id}
          requiresFollowRequest={requiresFollowRequest}
          canViewFollowers={canViewFollowers}
          canViewFollowing={canViewFollowing}
          mutualFollowersCount={mutualFollowersCount}
        />

        {canViewPosts ? (
          <ProfileContentTabs
            posts={posts}
            threads={threads}
            username={profile.username ?? ""}
            isOwner={isOwner}
            profileId={profile.id}
            hasMorePosts={hasMore}
            savedPageSize={POSTS_PAGE_LIMIT}
          />
        ) : (
          <div className="text-center text-muted-foreground py-16 border-t">
            <Lock className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-xl font-semibold">This Account is Private</h3>
            <p>Follow this account to see their posts.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// --- Helper Functions ---

async function checkIfFollowing(
  supabase: SupabaseClient<any>,
  currentUserId: string | undefined,
  profileId: string,
  isOwner: boolean
): Promise<boolean> {
  if (!currentUserId || isOwner) return false;

  const { data } = await supabase
    .from("followers")
    .select("follower_id")
    .eq("follower_id", currentUserId)
    .eq("following_id", profileId)
    .single();

  return Boolean(data);
}

async function fetchUserContent(
  supabase: SupabaseClient<any>,
  profileId: string,
  canViewPosts: boolean,
  limit: number
): Promise<{ content: Partial<Post>[]; hasMore: boolean; totalCount: number }> {
  if (!canViewPosts) return { content: [], hasMore: false, totalCount: 0 };

  const { data, error, count } = await supabase
    .from("posts")
    .select(
      `
        id,
        user_id,
        text,
        media,
        created_at,
        like_count,
        comment_count,
        share_count,
        save_count,
        author:profiles(id, username, display_name, avatar_url)
      `,
      { count: "exact" }
    )
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (error) {
    console.error("Error fetching profile posts:", error);
    return { content: [], hasMore: false, totalCount: 0 };
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;

  return { content: trimmed as unknown as Partial<Post>[], hasMore, totalCount: count ?? trimmed.length };
}