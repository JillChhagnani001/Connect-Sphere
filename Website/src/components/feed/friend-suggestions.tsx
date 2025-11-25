"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowButton } from "./follow-button";
import { Users } from "lucide-react";
import Link from "next/link"; // <--- Added Link import

interface FriendSuggestionsProps {
  currentUserId: string;
}

export function FriendSuggestions({ currentUserId }: FriendSuggestionsProps) {
  if (!currentUserId) return null;
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      const supabase = createClient();
      
      const { data, error } = await supabase.rpc('get_all_suggestions', {
        current_user_id: currentUserId
      });

      if (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]); 
      } else if (data) {
        setSuggestions(data as UserProfile[]);
      }
      setIsLoading(false);
    };

    if (currentUserId) {
      fetchSuggestions();
    }
  }, [currentUserId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            People you may know
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-3 w-[60px]" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null; 
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          People you may know
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((user) => (
          <div key={user.id} className="flex items-center justify-between">
            
            {/* --- START OF CLICKABLE AREA --- */}
            <Link 
              href={`/profile/${user.username}`} 
              className="flex items-center gap-3 flex-1 min-w-0 group"
            >
              <Avatar className="h-10 w-10 group-hover:opacity-80 transition-opacity">
                <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                <AvatarFallback>{(user.display_name || user.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate group-hover:underline underline-offset-2">
                  {user.display_name || user.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              </div>
            </Link>

            <div className="ml-2">
              <FollowButton
                targetUserId={user.id}
                currentUserId={currentUserId}
                isPrivate={user.is_private} 
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}