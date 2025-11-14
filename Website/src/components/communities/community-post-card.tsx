"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Heart, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CommunityCommentsSection } from "./community-comments-section";

interface CommunityPostCardProps {
  post: CommunityPost;
  communityId: number;
  isPremiumMember?: boolean;
}

interface CommunityPost {
  id: number;
  created_at?: string;
  author: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null };
  text?: string | null;
  media?: { url: string; mime_type: string }[] | null;
  hashtags?: string[] | null;
  is_premium?: boolean;
  is_liked?: boolean;
  like_count?: number;
  comment_count?: number;
}

export function CommunityPostCard({ post, communityId, isPremiumMember = false }: CommunityPostCardProps) {
  const [timeAgo, setTimeAgo] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number>(post.comment_count || 0);
  const { toast } = useToast();

  useEffect(() => {
    if (post.created_at) {
      setTimeAgo(formatDistanceToNow(new Date(post.created_at), { addSuffix: true }));
    }
  }, [post.created_at]);

  const handleLike = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "You must be logged in to like posts",
        });
        return;
      }

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('community_post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (!error) {
          setIsLiked(false);
          setLikeCount(prev => Math.max(0, prev - 1));
        }
      } else {
        // Like
        const { error } = await supabase
          .from('community_post_likes')
          .insert({
            post_id: post.id,
            user_id: user.id,
          });

        if (!error) {
          setIsLiked(true);
          setLikeCount(prev => prev + 1);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
          });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  };

  // Check if user can view premium content
  const canViewContent = !post.is_premium || isPremiumMember;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Link href={`/profile/${post.author.username || post.author.id}`}>
            <Avatar className="h-10 w-10 cursor-pointer">
              <AvatarImage src={post.author.avatar_url ?? undefined} alt={post.author.display_name} />
              <AvatarFallback>{post.author.display_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/profile/${post.author.username || post.author.id}`}>
                <span className="font-semibold hover:underline">{post.author.display_name}</span>
              </Link>
              {post.is_premium && (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="h-3 w-3" />
                  Premium
                </Badge>
              )}
            </div>
            {timeAgo && (
              <span className="text-sm text-muted-foreground">{timeAgo}</span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {canViewContent ? (
          <>
            {post.text && (
              <p className="text-sm whitespace-pre-wrap">{post.text}</p>
            )}
            {post.media && post.media.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {post.media.map((media: { url: string; mime_type: string }, idx: number) => (
                  <div key={idx} className="relative aspect-video w-full rounded-lg overflow-hidden bg-muted">
                    {media.mime_type.startsWith('image/') ? (
                      <Image
                        src={media.url}
                        alt={`Post media ${idx + 1}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <video src={media.url} controls className="w-full h-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.hashtags.map((tag: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="border border-dashed rounded-lg p-8 text-center bg-muted/50">
            <Crown className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold mb-1">Premium Content</p>
            <p className="text-sm text-muted-foreground">
              Join as a paid member to view this exclusive content
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 pt-3 border-t">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            disabled={isLiking || !canViewContent}
            className="gap-2"
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            <span>{likeCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setShowComments(prev => !prev)}
            disabled={!canViewContent}
          >
            <MessageSquare className="h-4 w-4" />
            <span>{commentsCount}</span>
          </Button>
        </div>
        {showComments && canViewContent && (
          <CommunityCommentsSection postId={post.id} onCountChange={(c) => setCommentsCount(c)} />
        )}
      </CardFooter>
    </Card>
  );
}

