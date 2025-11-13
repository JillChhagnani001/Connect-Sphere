"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Bookmark } from "lucide-react";
import type { Post } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { PostClickHandler } from "./PostClickHandler";

const GRID_CLASS = "grid grid-cols-3 md:grid-cols-3 gap-1 md:gap-4";

type SavedPostsTabProps = {
  profileId: string;
  isOwner: boolean;
  isActive: boolean;
  pageSize: number;
};

export function SavedPostsTab({ profileId, isOwner, isActive, pageSize }: Readonly<SavedPostsTabProps>) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!isOwner || !isActive || hasFetchedRef.current) {
      return;
    }

    const supabase = createClient();
    hasFetchedRef.current = true;
    setLoading(true);

    const fetchSavedPosts = async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          `
            post:posts!inner(
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
            )
          `
        )
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(pageSize);

      if (error) {
        setError(error.message);
        setPosts([]);
      } else {
        const bookmarks = (data ?? []) as Array<{ post: unknown }>;
        setPosts(
          bookmarks
            .map((bookmark) => bookmark.post)
            .filter(isValidPost)
        );
      }
    };

    fetchSavedPosts().finally(() => setLoading(false));
  }, [isOwner, isActive, pageSize, profileId]);

  if (!isOwner) {
    return (
      <div className="text-center text-muted-foreground py-16 border-t">
        <Bookmark className="h-12 w-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Saved Posts</h3>
        <p>Only the profile owner can view their saved posts.</p>
      </div>
    );
  }

  if (!isActive && posts === null) {
    return (
      <div className="text-center text-muted-foreground py-16">
        <Bookmark className="h-12 w-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Saved Posts</h3>
        <p>Select this tab to load your saved posts.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading saved posts…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-rose-500 py-16">
        <p>Unable to load saved posts right now.</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16">
        <Bookmark className="h-12 w-12 mx-auto mb-4" />
        <h3 className="text-xl font-semibold">Nothing Saved Yet</h3>
        <p>Start saving posts to see them here.</p>
      </div>
    );
  }

  return (
    <div className={GRID_CLASS}>
      {posts.map((post) => (
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
              <span className="text-xs text-muted-foreground p-2">{post.text}</span>
            </div>
          )}
        </PostClickHandler>
      ))}
    </div>
  );
}

function isValidPost(candidate: unknown): candidate is Post {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  return "id" in candidate && "user_id" in candidate && "created_at" in candidate;
}
