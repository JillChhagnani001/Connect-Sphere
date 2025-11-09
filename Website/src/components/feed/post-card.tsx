// @ts-nocheck
"use client"
import Image from "next/image";
import Link from "next/link";
import { MoreHorizontal, MessageSquare, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import type { Post } from "@/lib/types";
import { Input } from "../ui/input";
import { EngagementActions } from "./engagement-actions";
import { CommentsSection } from "@/components/feed/comments-section";
import placeholderData from "@/lib/placeholder-data";
import { createClient } from "@/lib/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function PostCard({ post }: { post: Post }) {
  const [timeAgo, setTimeAgo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showComments, setShowComments] = useState(false);
  const [collabProfiles, setCollabProfiles] = useState<any[]>([]);
  const profile = placeholderData.users[0];

  useEffect(() => {
    if (post.created_at) {
      try {
        setTimeAgo(formatDistanceToNow(new Date(post.created_at), { addSuffix: true }));
      } catch (e) {
        setTimeAgo('recently');
      }
    }
  }, [post.created_at]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));

    const fetchCollabs = async () => {
      if (!Array.isArray(post.collaborators)) {
        setCollabProfiles([]);
        return;
      }

      // Only show collaborators who have ACCEPTED
      const accepted = post.collaborators.filter((c: any) => c && c.accepted);
      if (accepted.length === 0) {
        setCollabProfiles([]);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', accepted.map((c: any) => c.user_id));
      
      setCollabProfiles(data?.filter(Boolean) || []);
    };
    fetchCollabs();
  }, [post.collaborators]);

  // Helper to safely get initials
  const getInitials = (name?: string | null) => {
    return (name || '?').charAt(0).toUpperCase();
  };

  return (
    <Card className="w-full rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 p-4">
        <Link href={`/profile/${post.author?.username}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.avatar_url} alt={post.author?.display_name} />
            <AvatarFallback>{getInitials(post.author?.display_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 flex items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <Link href={`/profile/${post.author?.username}`} className="font-semibold hover:underline text-sm">
                {post.author?.display_name || 'Unknown User'}
              </Link>
              
              {/* Collaborators Icon & Popover */}
              {collabProfiles.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary ml-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="sr-only">View collaborators</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2" align="start">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2">In collaboration with</h4>
                    <div className="space-y-1">
                      {collabProfiles.map(p => (
                        <Link key={p.id} href={`/profile/${p.username}`} className="flex items-center gap-2 hover:bg-muted p-2 rounded-md transition-colors">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={p.avatar_url} />
                            <AvatarFallback>{getInitials(p.display_name || p.username)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium leading-none truncate">{p.display_name || p.username}</span>
                            {p.username && <span className="text-xs text-muted-foreground truncate">@{p.username}</span>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{timeAgo}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        {post.text && <p className="mb-4 text-sm">{post.text}</p>}
        {post.media?.[0] && (
          <div className="relative w-full aspect-auto rounded-lg border overflow-hidden">
            {post.media[0].mime_type?.startsWith('video') ? (
              <video src={post.media[0].url} controls className="w-full h-auto max-h-[600px] bg-black" />
            ) : (
              <Image
                src={post.media[0].url}
                alt="Post media"
                width={post.media[0].width || 800}
                height={post.media[0].height || 600}
                className="object-cover w-full h-auto max-h-[600px]"
              />
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start p-4 gap-4">
        <EngagementActions post={post} currentUserId={currentUserId} onCommentClick={() => setShowComments(prev => !prev)} />
        {showComments && <CommentsSection postId={post.id} currentUserId={currentUserId} />}
      </CardFooter>
    </Card>
  );
}