import { AppShell } from "@/components/app-shell";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Grid3x3, Bookmark, UserSquare2 } from "lucide-react";
import placeholderData from "@/lib/placeholder-data";
import type { Post } from "@/lib/types";

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const { username } = params;
  const user = placeholderData.users.find(u => u.username === username) || placeholderData.users[0];
  const posts: Post[] = placeholderData.posts.filter(p => p.author.username === user.username);
  
  const userProfile = {
    ...user,
    postsCount: posts.length,
    followersCount: Math.floor(Math.random() * 5000),
    followingCount: Math.floor(Math.random() * 500),
    isPrivate: false,
    isVerified: true,
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <ProfileHeader user={userProfile} profileId={user.id} />
        
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="posts"><Grid3x3 className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Posts</span></TabsTrigger>
            <TabsTrigger value="saved"><Bookmark className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Saved</span></TabsTrigger>
            <TabsTrigger value="tagged"><UserSquare2 className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Tagged</span></TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-6">
            <div className="grid grid-cols-3 md:grid-cols-3 gap-1 md:gap-4">
              {posts && posts.map((post) => (
                <div key={post.id} className="relative aspect-square">
                   {post.media && post.media.length > 0 ? (
                    <Image src={post.media[0].url} alt={post.text || 'Post image'} fill className="object-cover rounded-md md:rounded-lg" data-ai-hint="social media post"/>
                   ) : (
                    <div className="bg-muted h-full w-full rounded-md md:rounded-lg flex items-center justify-center">
                      <span className="text-xs text-muted-foreground p-2">{post.text}</span>
                    </div>
                   )}
                </div>
              ))}
            </div>
             {(!posts || posts.length === 0) && (
                <div className="text-center text-muted-foreground py-16 col-span-3">
                    <Grid3x3 className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold">No Posts Yet</h3>
                    <p>This user hasn't shared any posts.</p>
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
      </div>
    </AppShell>
  );
}
