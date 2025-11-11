// jillchhagnani001/connect-sphere/Connect-Sphere-fc87c8cec300ede2b5630444df2c602d79c0486f/Website/src/app/profile/[username]/page.tsx
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3x3, Bookmark, UserSquare2, Lock, FileText, Heart, MessageSquare, Share2, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import type { Post } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { PostClickHandler } from "@/components/profile/PostClickHandler";

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

  // 1. Get Profile and Privacy Settings
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      *,
      privacy_settings ( profile_visibility, allow_follow_requests, show_followers, show_following )
    `)
    .eq("username", params.username)
    .single();

  if (error || !profile) {
    console.error("Error fetching profile:", error);
    notFound();
  }
  
  const settings = profile.privacy_settings;

  // 2. Determine Privacy and Ownership
  const isProfilePrivate = (settings?.profile_visibility ?? 'public') === 'private';
  const requiresFollowRequest = (settings?.profile_visibility ?? 'public') !== 'public';
  const isOwner = authUser?.id === profile.id;

  // 3. Check Follow Status
  let isFollowing = false;
  if (authUser && !isOwner) {
    const { data: follow } = await supabase
      .from("followers")
      .select("follower_id")
      .eq("follower_id", authUser.id)
      .eq("following_id", profile.id)
      .single();
    isFollowing = !!follow;
  }

  // 4. Determine ALL Access Rights
  const canViewPosts = !isProfilePrivate || isOwner || isFollowing;
  
  // --- THIS IS THE NEW LOGIC ---
  // You can view lists if:
  // 1. You are the owner.
  // 2. OR the setting is true AND (the profile is public OR you are following them).
  const canViewFollowers = isOwner || (
    (settings?.show_followers ?? true) && (!isProfilePrivate || isFollowing)
  );
  const canViewFollowing = isOwner || (
    (settings?.show_following ?? true) && (!isProfilePrivate || isFollowing)
  );

  // 5. Fetch All Content (Posts & Threads)
  let allContent: Partial<Post>[] = [];
  if (canViewPosts) {
    const { data: contentData } = await supabase
      .from("posts")
      .select("*, author:profiles(*)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    
    if (contentData) {
      allContent = contentData;
    }
  }

  // 6. Filter content
  const posts = allContent.filter(p => p.media && p.media.length > 0);
  const threads = allContent.filter(p => !p.media || p.media.length === 0);
  const postsCount = allContent.length;

  // 7. Fetch Saved Posts (Bookmarks)
  let savedPosts: Post[] = [];
  if (isOwner) {
    const { data: savedBookmarks, error: savedError } = await supabase
      .from('bookmarks')
      .select(`
          post_id,
          post:posts!inner(*, author:profiles(*))
        `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (savedError) {
      console.error("Error fetching saved posts:", savedError);
    }
    
    savedPosts = (savedBookmarks
      ? (savedBookmarks.map(bookmark => bookmark.post).filter(Boolean) as Post[])
      : []);
  }
  
  // 8. Assemble the prop for ProfileHeader
  const userProfile = {
    ...profile,
    postsCount: postsCount ?? 0,
    followersCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    is_private: isProfilePrivate, // This controls the Lock icon
    isVerified: false, 
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader
          user={userProfile}
          currentUserId={authUser?.id}
          requiresFollowRequest={requiresFollowRequest}
          // --- PASS NEW PROPS ---
          canViewFollowers={canViewFollowers}
          canViewFollowing={canViewFollowing}
        />

        {canViewPosts ? (
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="posts">
                <Grid3x3 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="threads">
                <FileText className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Threads</span>
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
                    <PostClickHandler key={post.id} post={post}>
                      {post.media?.[0]?.url ? (
                        <Image
                          src={post.media[0].url}
                          alt={post.text || "Post image"}
                          fill
                          className="object-cover rounded-md md:rounded-lg"
                        />
                      ) : (
                        <div className="bg-muted h-full w-full rounded-md md:rounded-lg" />
                      )}
                    </PostClickHandler>
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
            
            <TabsContent value="threads" className="mt-6">
              {threads.length > 0 ? (
                <div className="space-y-6 max-w-2xl">
                  {threads.map((thread) => (
                    <PostClickHandler key={thread.id} post={thread}>
                      <div className="flex gap-4 border-b pb-6">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={thread.author?.avatar_url || ''} alt={thread.author?.display_name || ''} />
                          <AvatarFallback>{thread.author?.display_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{thread.author?.username}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(thread.created_at!), { addSuffix: true })}
                              </p>
                            </div>
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-sm">{thread.text}</p>
                          <div className="flex items-center gap-4 text-muted-foreground text-sm pt-2">
                            <div className="flex items-center gap-1">
                              <Heart className="h-4 w-4" />
                              <span>{thread.like_count ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              <span>{thread.comment_count ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Share2 className="h-4 w-4" />
                              <span>{thread.share_count ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Bookmark className="h-4 w-4" />
                              <span>{thread.save_count ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </PostClickHandler>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-16 col-span-3">
                  <FileText className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold">No Threads Yet</h3>
                  <p>This user hasn't posted any threads.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved" className="mt-6">
              <div className="grid grid-cols-3 md:grid-cols-3 gap-1 md:gap-4">
                  {savedPosts.length > 0 ? (
                      savedPosts.map((post) => (
                          <PostClickHandler key={post.id} post={post} context="saved">
                              {post.media?.[0]?.url ? (
                                  <Image
                                      src={post.media[0].url}
                                      alt={post.text || "Saved post image"}
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
                          </PostClickHandler>
                      ))
                  ) : (
                      <div className="text-center text-muted-foreground py-16 col-span-3">
                          <Bookmark className="h-12 w-12 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold">Nothing Saved Yet</h3>
                          <p>Start saving posts to see them here.</p>
                      </div>
                  )}
              </div>
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