import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowList } from "@/components/profile/follow-list";
import { Grid3x3, Bookmark, UserSquare2, Lock, Users, UserCheck } from "lucide-react"; 
import Image from "next/image";
import { Grid3x3, Bookmark, UserSquare2, Lock } from "lucide-react";
import type { Post } from "@/lib/types";
import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { username: string } }) {
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

  const { data: { user: authUser } } = await supabase.auth.getUser();
  // console.log("1. Current User:", authUser?.id);

  // 1. Get Profile, Settings, and Counts in ONE query
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, bio, website, location, created_at")
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    notFound();
  }
  // console.log("2. Fetched Profile Data (Raw):", profile);

  // 3. Determine Privacy (for POSTS)
  const isProfilePrivate = (profile.privacy_settings?.profile_visibility ?? 'public') === 'private';
  // console.log(`3. Privacy Check (Posts): isProfilePrivate? ${isProfilePrivate} (Value: ${profile.privacy_settings?.profile_visibility})`);

  // 4. Determine Privacy (for BUTTON)
  const requiresFollowRequest = (profile.privacy_settings?.profile_visibility ?? 'public') !== 'public';
  // console.log(`4. Privacy Check (Button): requiresFollowRequest? ${requiresFollowRequest} (Value: ${profile.privacy_settings?.allow_follow_requests})`);

  // 5. Check Ownership
  const isOwner = authUser?.id === profile.id;
  // console.log("5. Relationship: isOwner?", isOwner);

  // 6. Check Follow Status
  let isFollowing = false;

  if (currentUser && !isOwner) {
    const { data: follow } = await supabase
      .from("followers")
      .select("follower_id")
      .eq("follower_id", authUser.id)
      .eq("following_id", profile.id)
      .eq("status", "accepted")
      .single();
    
    // console.log("6. Follow Check: Found follow relationship?", follow);
    isFollowing = !!follow;
  }
  // console.log("7. Relationship: isFollowing?", isFollowing);

  // 7. Check Post Access
  const canViewPosts = !isProfilePrivate || isOwner || isFollowing;
  // console.log(`8. Final Access: canViewPosts? ${canViewPosts} (!${isProfilePrivate} || ${isOwner} || ${isFollowing})`);

  // 8. Get Post Count (always show this)
  const { count: postsCount } = await supabase
    .from("posts")
    .select("", { count: "exact", head: true })
    .eq("user_id", profile.id);
  // console.log("9. Post Count:", postsCount);

  // Fetch Posts (if permitted)
  let posts: Post[] = [];
  if (canViewPosts) {
    const { data: postsData } = await supabase
      .from("posts")
      .select("id, media, text")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    posts = (postsData as Post[]) || [];
    // console.log(`10. Fetched ${posts.length} posts.`);
  } else {
    // console.log("10. Did not fetch posts (access denied).");
  }

  // Compose Final User Object 
  const userProfile = {
    ...profile,
    postsCount: postsCount ?? 0,
    followersCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    is_private: isProfilePrivate,
    isVerified: false,
  };
  // console.log("11. Final userProfile prop:", userProfile);

  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader
          user={userProfile}
          currentUserId={authUser?.id}
          requiresFollowRequest={requiresFollowRequest}
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
                      {post.media && post.media[0] && post.media[0].url ? (
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
