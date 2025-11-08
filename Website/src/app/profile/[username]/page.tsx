



import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Grid3x3, Bookmark, UserSquare2, Lock, FileText, Heart, MessageSquare, Repeat, Send, MoreHorizontal, Share2 } from "lucide-react";
import type { Post } from "@/lib/types";
import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const supabase = await createServerClient();
  const { username } = params;

  // Get Current User & Profile
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, bio, website, location, created_at, follower_count, following_count")
    .eq("username", username)
    .single();

  if (profileError || !profile) {
  if (profileError || !profile) {
    notFound();
  }

  // Privacy Settings 
  const { data: privacySetting } = await supabase
    .from("privacy_settings")
    .select("profile_visibility")
    .eq("user_id", profile.id)
    .single();

  const isPrivate = privacySetting?.profile_visibility === "private";

  // Relationship / Follow State 
  const isOwner = currentUser?.id === profile.id;
  let isFollowing = false;

  if (currentUser && !isOwner) {

  if (currentUser && !isOwner) {
    const { data: follow } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .eq("status", "accepted")
      .eq("status", "accepted")
      .single();
    isFollowing = !!follow;
  }

  // Access Control 
  const canViewPosts = !isPrivate || isOwner || isFollowing;

  // Fetch Posts & Threads
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

  // Filter content based on media presence
  const posts = allContent.filter(p => p.media && p.media.length > 0);
  const threads = allContent.filter(p => !p.media || p.media.length === 0);
  
  const postsCount = allContent.length;

  // Compose Final User Object 
  const userProfile = {
    ...profile,
    postsCount: postsCount,
    followersCount: profile.follower_count ?? 0,
    followingCount: profile.following_count ?? 0,
    isPrivate,
    isVerified: false,
  };

  //  Render 
  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader
          user={{ ...userProfile, is_private: userProfile.isPrivate }}
          currentUserId={currentUser?.id}
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
                    <div key={post.id} className="relative aspect-square">
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
            
            <TabsContent value="threads" className="mt-6">
                {threads.length > 0 ? (
                    <div className="space-y-6 max-w-2xl">
                    {threads.map((thread) => (
                      <div key={thread.id} className="flex gap-4 border-b pb-6">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={thread.author?.avatar_url || ''} alt={thread.author?.display_name || ''}/>
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
