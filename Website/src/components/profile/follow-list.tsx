"use client";

import { useState, useEffect } from "react";
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

interface FollowUser {
  profiles: UserProfile;
}

export function FollowList({ userId, currentUserId, type }: FollowListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFollows = async () => {
      setIsLoading(true);
      const supabase = createClient();

      let query;
      if (type === 'followers') {
        // Get all profiles that follow this user
        query = supabase
          .from('followers')
          .select('...profiles!follower_id(*)')
          .eq('following_id', userId);
      } else {
        // Get all profiles this user follows
        query = supabase
          .from('followers')
          .select('...profiles!following_id(*)')
          .eq('follower_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${type}:`, error);
      } else if (data) {
        // The data is nested, so we extract the profile
        const profiles = data.map((item: any) => item.profiles).filter(Boolean);
        setUsers(profiles as UserProfile[]);
      }
      setIsLoading(false);
    };

    fetchFollows();
  }, [userId, type]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
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
    <div className="space-y-4">
      {users.map((user) => (
        <div key={user.id} className="flex items-center justify-between">
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
          {currentUserId && currentUserId !== user.id && (
            <FollowButton
              targetUserId={user.id}
              currentUserId={currentUserId}
              isPrivate={user.is_private}
            />
          )}
        </div>
      ))}
    </div>
  );
}