import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileContentTabs } from "@/components/profile/profile-content-tabs";
import { Lock } from "lucide-react";
import { BannedNotice } from "@/components/banned-notice";

import type { Post } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const POSTS_PAGE_LIMIT = 20;

type ProfilePageProps = Readonly<{
  params: Promise<Readonly<{ username: string }>>;
}>;

export default async function ProfilePage({ params }: ProfilePageProps) {
  const supabase = createServerClient();
  const { username } = await params;

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
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile:", profileError);
    notFound();
  }

  const bannedUntilValue = profile.banned_until ? new Date(profile.banned_until) : null;
  const isProfileBanned = Boolean(profile.ban_reason) && (!bannedUntilValue || bannedUntilValue.getTime() > Date.now());

  const settings = profile.privacy_settings;
  const isProfilePrivate = (settings?.profile_visibility ?? "public") === "private";
  const requiresFollowRequest = (settings?.profile_visibility ?? "public") !== "public";
  const isOwner = authUser?.id === profile.id;

  // 2. Fetch follow status and mutual followers in parallel
  const [isFollowing, mutualResult] = await Promise.all([
    isProfileBanned ? Promise.resolve(false) : checkIfFollowing(supabase, authUser?.id, profile.id, isOwner),
    authUser?.id && !isOwner && !isProfileBanned
      ? supabase.rpc("get_mutual_count", { viewer_id: authUser.id, target_id: profile.id })
      : Promise.resolve({ data: 0 }),
  ]);

  const mutualFollowersCount = (mutualResult as any)?.data ?? 0;

  // 3. Determine access rights
  const canViewPosts = !isProfileBanned && (!isProfilePrivate || isOwner || isFollowing);
  const canViewFollowers = isOwner || ((settings?.show_followers ?? true) && (!isProfilePrivate || isFollowing));
  const canViewFollowing = isOwner || ((settings?.show_following ?? true) && (!isProfilePrivate || isFollowing));

  // 4. Fetch posts (MODIFIED to fetch user content AND tagged content)
  const [userContentResult, taggedContentResult] = await Promise.all([
    fetchUserContent(
      supabase,
      profile.id,
      canViewPosts,
      POSTS_PAGE_LIMIT
    ),
    fetchTaggedContent( // ADDED this call
      supabase,
      profile.id,
      canViewPosts,
      POSTS_PAGE_LIMIT
    )
  ]);

  // Destructure user's own content
  const { content: allContent, hasMore, totalCount } = userContentResult;
  // Destructure tagged content (ADDED)
  const { content: taggedPosts, hasMore: hasMoreTagged } = taggedContentResult;

  const posts = allContent.filter(p => p.media && p.media.length > 0);
  const threads = allContent.filter(p => !p.media || p.media.length === 0);
  const postsCount = totalCount; // This remains the count of the user's *own* posts

  const userProfile = {
    ...profile,
    postsCount: postsCount ?? 0,
    followersCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    is_private: isProfilePrivate,
    isVerified: Boolean(profile.is_verified),
  };

  let profileContent: React.ReactNode;
  if (isProfileBanned) {
    profileContent = isOwner ? (
      <BannedNotice
        reason={profile.ban_reason}
        bannedUntil={profile.banned_until}
        description="This profile is temporarily unavailable because it violated our community guidelines. While the suspension is active, posts and profile details stay hidden."
        className="py-20"
      />
    ) : (
      <div className="text-center text-muted-foreground py-16 border-t">
        <Lock className="h-12 w-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Account Suspended</h3>
        <p>This account has been suspended. Posts are hidden while the suspension is active.</p>
      </div>
    );
  } else if (canViewPosts) {
    profileContent = (
      <ProfileContentTabs
        posts={posts}
        threads={threads}
        taggedPosts={taggedPosts} // <-- ADDED PROP
        username={profile.username ?? ""}
        isOwner={isOwner}
        profileId={profile.id}
        hasMorePosts={hasMore}
        hasMoreTagged={hasMoreTagged} // <-- ADDED PROP
        savedPageSize={POSTS_PAGE_LIMIT}
      />
    );
  } else {
    profileContent = (
      <div className="text-center text-muted-foreground py-16 border-t">
        <Lock className="h-12 w-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">This Account is Private</h3>
        <p>Follow this account to see their posts.</p>
      </div>
    );
  }

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
          isBanned={isProfileBanned}
        />

        {profileContent}
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
    .eq("is_archived", false)
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

// --- ADDED NEW HELPER FUNCTION ---
async function fetchTaggedContent(
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
    // The query is changed to look for the profileId in the collaborators array
    .contains("collaborators", `[{"user_id": "${profileId}", "accepted": true}]`)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (error) {
    console.error("Error fetching tagged posts:", error);
    return { content: [], hasMore: false, totalCount: 0 };
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;

  return { content: trimmed as unknown as Partial<Post>[], hasMore, totalCount: count ?? trimmed.length };
}