"use client"
import Image from "next/image";
import Link from "next/link";
import { MoreHorizontal, MessageSquare, ThumbsUp, Share2, Bookmark } from "lucide-react";
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

export function PostCard({ post }: { post: Post }) {
  const [timeAgo, setTimeAgo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showComments, setShowComments] = useState(false);
  const profile = placeholderData.users[0];

  useEffect(() => {
    if (post.created_at) {
      // Set the time ago string once on the client after hydration
      setTimeAgo(formatDistanceToNow(new Date(post.created_at), { addSuffix: true }));
    }
  }, [post.created_at]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    };
    getCurrentUser();
  }, []);


  return (
    <Card className="w-full rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 p-4">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatar_url} alt={post.author.display_name} data-ai-hint="user avatar" />
            <AvatarFallback>{post.author.display_name?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 flex items-center">
            <div className="flex flex-col">
                <Link href={`/profile/${post.author.username}`} className="font-semibold hover:underline text-sm">
                    {post.author.display_name}
                </Link>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {timeAgo || 'Loading...'}
                </span>
            </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        {post.text && <p className="mb-4 text-sm">{post.text.split('#').map((part, i) => i === 0 ? part : <Link href="#" key={i} className="text-primary hover:underline">#{part.split(' ')[0]}</Link>).reduce((prev, curr, i) => [prev, i > 1 ? " " : "", curr] as any)}</p>}
        {post.media && post.media.length > 0 && (
            <div className="relative w-full aspect-auto overflow-hidden rounded-lg border">
                 <Image 
                  src={post.media[0].url} 
                  alt={post.text || 'Post image'}
                  width={post.media[0].width || 800}
                  height={post.media[0].height || 600}
                  className="object-cover w-full h-auto"
                  data-ai-hint="social media post" />
            </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start p-4 gap-4">
        <EngagementActions 
          post={post} 
          currentUserId={currentUserId}
          onEngagementChange={() => {
            // Refresh post data or update local state
          }}
          onToggleComments={() => setShowComments(prev => !prev)}
        />
        
        {showComments && (
          <CommentsSection 
            postId={post.id} 
            currentUserId={currentUserId}
            onCommentCountChange={(count) => {
              post.comment_count = count; // update local post data
            }}
          />

        )}
        
        <div className="w-full flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url} alt="User Avatar" data-ai-hint="user avatar" />
            <AvatarFallback>{profile?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="relative flex-1">
            <Input 
              id={`comment-input-${post.id}`} // 👈 ADD THIS
              placeholder="Write your comment..." 
              className="bg-muted border-none rounded-full pr-20" 
              onFocus={() => setShowComments(true)}
            />

            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
