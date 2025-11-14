"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PostCard } from "./post-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";

const PAGE_SIZE = 20;

interface FeedListProps {
  initialPosts: Post[];
  currentUserId: string;
}

export function FeedList({ initialPosts, currentUserId }: FeedListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(0); // Page 0 is already loaded
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const observer = useRef<IntersectionObserver>();

  // Infinite Scroll Trigger
  const lastPostRef = useCallback((node: HTMLDivElement) => {
    if (isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => prev + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoadingMore, hasMore]);

  // Fetch Data Logic
  useEffect(() => {
    if (page === 0) return; // Skip initial load

    const fetchMore = async () => {
      setIsLoadingMore(true);
      const supabase = createClient();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .rpc('get_home_feed', { current_user_id: currentUserId })
        .select('*, author:profiles(*)')
        .range(from, to);

      if (error) {
        console.error("Error fetching more posts:", error);
      } else if (data) {
        const newPosts = data as Post[];
        
        if (newPosts.length < PAGE_SIZE) {
          setHasMore(false);
        }

        // Deduplicate posts (in case a new post shifted the offset)
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPosts];
        });
      }
      setIsLoadingMore(false);
    };

    fetchMore();
  }, [page, currentUserId]);

  return (
    <div className="space-y-6">
      {posts.map((post, index) => {
        // Attach ref to the last post to trigger next load
        if (index === posts.length - 1) {
          return (
            <div ref={lastPostRef} key={post.id}>
              <PostCard post={post} currentUserId={currentUserId} />
            </div>
          );
        }
        return <PostCard key={post.id} post={post} currentUserId={currentUserId} />;
      })}

      {isLoadingMore && (
        <div className="space-y-6 py-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[200px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[60%]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          You've reached the end of your feed!
        </div>
      )}
    </div>
  );
}