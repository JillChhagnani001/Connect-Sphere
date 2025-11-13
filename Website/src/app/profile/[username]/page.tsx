import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileContentTabs } from "@/components/profile/profile-content-tabs";
import { Lock } from "lucide-react";
import type { Post } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const revalidate = 30;

const POSTS_PAGE_LIMIT = 20;

type ProfilePageProps = Readonly<{
  params: Readonly<{ username: string }>;
}>;

export default async function ProfilePage({ params }: ProfilePageProps) {
  const supabase = createServerClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();

  // 1. Get Profile and Privacy Settings (from your HEAD branch logic)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      *,
      privacy_settings ( profile_visibility, allow_follow_requests )
    `)
    .eq("username", params.username)
    .single();

  if (error || !profile) {
    console.error("Error fetching profile:", error);
    notFound();
  }

  // 2. Determine Privacy (for POSTS)
  const isProfilePrivate = (profile.privacy_settings?.profile_visibility ?? 'public') === 'private';
  
  // 3. Determine Privacy (for BUTTON) - This is the logic from your branch
  // This is true if profile is 'private' or 'followers', but false if 'public'
  const requiresFollowRequest = (profile.privacy_settings?.profile_visibility ?? 'public') !== 'public';

  // 4. Check Ownership
  const isOwner = authUser?.id === profile.id;

  // 5. Check Follow Status (using your correct 'followers' table logic)
  const isFollowing = await checkIfFollowing(supabase, authUser?.id, profile.id, isOwner);

  // 6. Check Post Access
  const canViewPosts = !isProfilePrivate || isOwner || isFollowing;

  // 7. Fetch All Content (Posts & Threads) (from trashgrp branch)
  const { content: allContent, hasMore, totalCount } = await fetchUserContent(
    supabase,
    profile.id,
    canViewPosts,
    POSTS_PAGE_LIMIT
  );

  // 8. Filter content (from trashgrp branch)
  const posts = allContent.filter((p) => p.media && p.media.length > 0);
  const threads = allContent.filter((p) => !p.media || p.media.length === 0);
  const postsCount = totalCount;
  
  // 10. Assemble the prop for ProfileHeader
  const userProfile = {
    ...profile,
    postsCount: postsCount ?? 0,
    followersCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    is_private: isProfilePrivate, // This controls the Lock icon
    isVerified: Boolean(profile.is_verified),
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader
          user={userProfile}
          currentUserId={authUser?.id}
          // This prop controls the FollowButton logic (public vs. private)
          requiresFollowRequest={requiresFollowRequest}
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

async function checkIfFollowing(
  supabase: SupabaseClient<any>,
  currentUserId: string | undefined,
  profileId: string,
  isOwner: boolean
): Promise<boolean> {
  if (!currentUserId || isOwner) {
    return false;
  }

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
  if (!canViewPosts) {
    return { content: [], hasMore: false, totalCount: 0 };
  }

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

  return {
    content: trimmed as unknown as Partial<Post>[],
    hasMore,
    totalCount: count ?? trimmed.length,
  };
}