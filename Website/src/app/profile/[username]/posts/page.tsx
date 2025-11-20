import { AppShell } from "@/components/app-shell";
import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Post } from "@/lib/types";
import { PostCard } from "@/components/feed/post-card";
import { cookies } from "next/headers";
import { ScrollToPostClient } from "@/components/profile/ScrollToPostClient"; // NEW CLIENT COMPONENT

export const dynamic = "force-dynamic";

// Define the structure for URL search parameters (query params)
interface UserPostsPageProps {
  params: { username: string };
  searchParams: { postId?: string };
}

export default async function UserPostsPage({ params, searchParams }: UserPostsPageProps) {
  const supabase = createServerClient();
  const { username } = params;
  const targetPostId = searchParams.postId; // Get the ID of the post to scroll to

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name") // Fetch display_name too for the header
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  // --- Access Control Logic (kept for correctness) ---
  const { data: privacySetting } = await supabase
    .from("privacy_settings")
    .select("profile_visibility")
    .eq("user_id", profile.id)
    .single();

  const isPrivate = privacySetting?.profile_visibility === "private";
  const isOwner = currentUser?.id === profile.id;
  let isFollowing = false;

  if (currentUser && !isOwner) {
    const { data: follow } = await supabase
      .from("followers")
      .select("status")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .eq("status", "accepted")
      .single();
    isFollowing = !!follow;
  }

  const canViewPosts = !isPrivate || isOwner || isFollowing;
  if (!canViewPosts) {
    redirect(`/profile/${username}`);
  }
  // --- End Access Control Logic ---

  // Fetch ALL content (both posts and threads)
  const { data: allContent } = await supabase
    .from("posts")
    .select("*, author:profiles(*)")
    .eq("user_id", profile.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const posts = (allContent || []) as Post[];
  
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold tracking-tight border-b pb-4">
          All Posts by @{username}
        </h1>

        {/* This client component handles the scrolling to the target post */}
        {targetPostId && <ScrollToPostClient targetId={targetPostId} />}

        {posts.length > 0 ? (
          posts.map((post) => (
            // Use the post ID as a unique HTML anchor ID for scrolling
            <div id={`post-${post.id}`} key={post.id}>
              <PostCard post={post} />
            </div>
          ))
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <h3 className="text-xl font-semibold">No posts yet</h3>
            <p>Posts from this user will appear here.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}