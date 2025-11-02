import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Grid3x3, Bookmark, UserSquare2, Lock } from "lucide-react";
import type { Post } from "@/lib/types";
import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const supabase = createServerClient();
  const { username } = params;

  // Get Current User & Profile
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, bio, website, location, created_at")
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  // Privacy Settings 
  const { data: privacySetting } = await supabase
    .from("privacy_settings")
    .select("profile_visibility")
    .eq("user_id", profile.id)
    .single();

  // Only "public" or "private" modes supported
  const isPrivate = privacySetting?.profile_visibility === "private";

  // Relationship / Follow State 
  const isOwner = currentUser?.id === profile.id;
  let isFollowing = false;

  if (currentUser && !isOwner) {
    const { data: follow } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .eq("status", "accepted")
      .single();

    isFollowing = !!follow;
  }

  // Access Control 
  const canViewPosts = !isPrivate || isOwner || isFollowing;

  // Fetch Counts (for header) 
  const [{ count: postsCount }, { count: followersCount }, { count: followingCount }] =
    await Promise.all([
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id)
        .eq("status", "accepted"),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id)
        .eq("status", "accepted"),
    ]);

  // Fetch Posts (if permitted)
  let posts: Post[] = [];
  if (canViewPosts) {
    const { data: postsData } = await supabase
      .from("posts")
      .select("id, media, text")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    posts = postsData || [];
  }

  // Compose Final User Object 
  const userProfile = {
    ...profile,
    postsCount: postsCount ?? 0,
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
    isPrivate,
    isVerified: false,
  };

  //  Render 
  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader
          user={userProfile}
          currentUserId={currentUser?.id}
          isOwner={isOwner}
          isFollowing={isFollowing}
        />

        {canViewPosts ? (
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="posts">
                <Grid3x3 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="saved">
                <Bookmark className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Saved</span>
              </TabsTrigger>
              <TabsTrigger value="tagged">
                <UserSquare2 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Tagged</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              <div className="grid grid-cols-3 md:grid-cols-3 gap-1 md:gap-4">
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <div key={post.id} className="relative aspect-square">
                      {post.media?.[0]?.url ? (
                        <Image
                          src={post.media[0].url}
                          alt={post.text || "Post image"}
                          fill
                          className="object-cover rounded-md md:rounded-lg"
                        />
                      ) : (
                        <div className="bg-muted h-full w-full rounded-md md:rounded-lg flex items-center justify-center">
                          <span className="text-xs text-muted-foreground p-2">
                            {post.text}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-16 col-span-3">
                    <Grid3x3 className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold">No Posts Yet</h3>
                    <p>This user hasn't shared any posts.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="saved" className="mt-6 text-center text-muted-foreground py-16">
              <Bookmark className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">Saved Posts</h3>
              <p>Your saved posts will appear here.</p>
            </TabsContent>

            <TabsContent value="tagged" className="mt-6 text-center text-muted-foreground py-16">
              <UserSquare2 className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">Tagged Posts</h3>
              <p>Posts you're tagged in will appear here.</p>
            </TabsContent>
          </Tabs>
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
