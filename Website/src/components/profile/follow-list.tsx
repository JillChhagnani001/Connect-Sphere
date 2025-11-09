// jillchhagnani001/connect-sphere/Connect-Sphere-fc87c8cec300ede2b5630444df2c602d79c0486f/Website/src/components/profile/follow-list.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowButton } from "../feed/follow-button";

interface FollowListProps {
  userId: string;
  currentUserId?: string;
  type: 'followers' | 'following';
}

const PAGE_SIZE = 20; // Load 20 users at a time

export function FollowList({ userId, currentUserId, type }: FollowListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const observer = useRef<IntersectionObserver>();
  
  // This callback will be attached to the last element in the list
  const lastUserElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading || isLoadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        // User has scrolled to the bottom, load more
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, hasMore]);

  const fetchFollows = useCallback(async (pageNum: number) => {
    if (pageNum === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    const supabase = createClient();
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query;
    if (type === 'followers') {
      // Get all profiles that follow this user
      query = supabase
        .from('followers')
        .select('...profiles!follower_id(*)')
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
    } else {
      // Get all profiles this user follows
      query = supabase
        .from('followers')
        .select('...profiles!following_id(*)')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching follows:", error);
      setHasMore(false); // Stop trying
    } else if (data) {
      // Supabase returns the joined profile directly
      const newUsers = data as unknown as UserProfile[];
      
      setUsers(prevUsers => {
        // Avoid adding duplicates
        const existingIds = new Set(prevUsers.map(u => u.id));
        const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.id));
        return [...prevUsers, ...uniqueNewUsers];
      });
      
      if (newUsers.length < PAGE_SIZE) {
        setHasMore(false); // This was the last page
      }
    }
    
    if (pageNum === 0) {
      setIsLoading(false);
    } else {
      setIsLoadingMore(false);
    }
  }, [userId, type]);

  // Fetch initial data (page 0)
  useEffect(() => {
    // Reset state for when modal re-opens
    setUsers([]);
    setPage(0);
    setHasMore(true);
    setIsLoading(true);
    fetchFollows(0);
  }, [fetchFollows]); // fetchFollows is stable

  // Fetch more data when page changes
  useEffect(() => {
    if (page > 0) {
      fetchFollows(page);
    }
  }, [page]); // Removed fetchFollows from dep array

  if (isLoading) {
    return (
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[150px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4">
        No {type} found.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
      {users.map((user, index) => (
        <div 
          // Add the ref to the last element
          ref={users.length === index + 1 ? lastUserElementRef : null}
          key={user.id} 
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url || undefined} alt={user.display_name || user.username} />
              <AvatarFallback>{(user.display_name || user.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">{user.display_name || user.username}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </div>
          {/* Show follow button if it's not the current user's own profile */}
          {user.id !== currentUserId && (
            <FollowButton
              targetUserId={user.id}
              currentUserId={currentUserId}
              isPrivate={user.is_private}
            />
          )}
        </div>
      ))}
      {isLoadingMore && (
        <div className="flex items-center gap-4 pt-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[100px]" />
          </div>
        </div>
      )}
      {!hasMore && users.length > PAGE_SIZE && (
        <p className="text-muted-foreground text-center text-sm py-2">
          You've reached the end.
        </p>
      )}
    </div>
  );
}