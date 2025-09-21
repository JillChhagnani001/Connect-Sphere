import { AppShell } from "@/components/app-shell";
import { CreatePost } from "@/components/feed/create-post";
import { PostCard } from "@/components/feed/post-card";
import { Stories } from "@/components/feed/stories";
import { FriendSuggestions } from "@/components/feed/friend-suggestions";
import { ProfileActivity } from "@/components/feed/profile-activity";
import placeholderData from "@/lib/placeholder-data";
import type { Post } from "@/lib/types";

export default async function FeedPage() {
  const posts: Post[] = placeholderData.posts;

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-2 xl:col-span-3 space-y-6">
          <Stories />
          <CreatePost />
          <div className="space-y-6">
            {posts && posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
             <div className="text-center py-16 text-muted-foreground">
                <h3 className="text-xl font-semibold">No posts yet</h3>
                <p>Follow people to see their posts here, or create your first post!</p>
             </div>
            )}
          </div>
        </div>
        <div className="hidden lg:block xl:col-span-1 space-y-6 sticky top-24">
            <FriendSuggestions />
            <ProfileActivity />
        </div>
      </div>
    </AppShell>
  );
}
