import { AppShell } from "@/components/app-shell";
import { CreatePost } from "@/components/feed/create-post";
import { Stories } from "@/components/feed/stories";
import { FriendSuggestions } from "@/components/feed/friend-suggestions";
import { FeedList } from "@/components/feed/feed-list"; 
import { createServerClient } from "@supabase/ssr"; 
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: initialPosts, error } = await supabase
    .rpc('get_home_feed', { current_user_id: user.id })
    .select('*, author:profiles(*)')
    .eq("is_archived", false)
    .range(0, 19); // Limit to first 20 items

  if (error) {
    console.error("Error fetching feed:", error);
  }

  return (
    <AppShell userId={user.id}>
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 gap-8 items-start">
        
        <div className="lg:col-span-2 xl:col-span-2 space-y-6">
          <Stories />
          <CreatePost />
          
          {initialPosts && initialPosts.length > 0 ? (
            <FeedList 
              initialPosts={initialPosts as Post[]} 
              currentUserId={user.id} 
            />
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <h3 className="text-xl font-semibold">Your feed is empty</h3>
              <p>Follow people to see their posts here, or create your first post!</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block xl:col-span-1 space-y-6 sticky top-24">
            <FriendSuggestions currentUserId={user.id} />
        </div>

      </div>
    </AppShell>
  );
}