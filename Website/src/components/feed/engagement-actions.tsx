"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageSquare, Share2, Bookmark, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Post, Like, Comment, Bookmark as BookmarkType, Share } from "@/lib/types";

interface EngagementActionsProps {
  post: Post;
  currentUserId?: string;
  onEngagementChange?: () => void;
}

export function EngagementActions({ post, currentUserId, onEngagementChange }: EngagementActionsProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.like_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comment_count || 0);
  const [sharesCount, setSharesCount] = useState(post.share_count || 0);
  const [bookmarksCount, setBookmarksCount] = useState(post.save_count || 0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUserId) {
      checkUserEngagement();
    }
  }, [currentUserId, post.id]);
  
  const checkUserEngagement = async () => {
    if (!currentUserId) return;

    const supabase = createClient();
    // table checks for clearer setup guidance
    const { error: likesTblErr } = await supabase.from('likes').select('id').limit(1);
    if (likesTblErr) {
      console.warn('Likes table access error:', likesTblErr);
    }
    const { error: bookmarksTblErr } = await supabase.from('bookmarks').select('id').limit(1);
    if (bookmarksTblErr) {
      console.warn('Bookmarks table access error:', bookmarksTblErr);
    }
    
    // Check if user has liked this post
    const { data: likeData } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .single();

    // Check if user has bookmarked this post
    const { data: bookmarkData } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .single();

    setIsLiked(!!likeData);
    setIsBookmarked(!!bookmarkData);
  };
    useEffect(() => {
      const fetchCounts = async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("posts")
          .select("like_count, share_count, save_count, comment_count")
          .eq("id", post.id)
          .single();

        if (!error && data) {
          setLikesCount(data.like_count || 0);
          setSharesCount(data.share_count || 0);
          setBookmarksCount(data.save_count || 0);
          setCommentsCount(data.comment_count || 0);
        }
      };
      fetchCounts();
    }, [post.id]);

  const handleLike = async () => {
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to like posts.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);

        if (error) throw error;

        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({
            post_id: post.id,
            user_id: currentUserId,
          });

        if (error) throw error;

        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }

      onEngagementChange?.();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: typeof error === 'object' && error && 'message' in error
          ? String((error as any).message)
          : `Failed to update like. ${JSON.stringify(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to bookmark posts.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);

        if (error) throw error;

        setIsBookmarked(false);
        setBookmarksCount(prev => Math.max(0, prev - 1));
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('bookmarks')
          .insert({
            post_id: post.id,
            user_id: currentUserId,
          });

        if (error) throw error;

        setIsBookmarked(true);
        setBookmarksCount(prev => prev + 1);
      }

      onEngagementChange?.();
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: "Error",
        description: typeof error === 'object' && error && 'message' in error
          ? String((error as any).message)
          : `Failed to update bookmark. ${JSON.stringify(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to share posts.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      // Check if this user already shared this post
      const { data: existingShare, error: fetchError } = await supabase
        .from('shares')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingShare) {
        toast({
          title: "Already shared",
          description: "You’ve already shared this post.",
        });
        setIsLoading(false);
        return;
      }

      // Record share
      const { error } = await supabase
        .from('shares')
        .insert({
          post_id: post.id,
          user_id: currentUserId,
        });

      if (error) throw error;

      setSharesCount(prev => prev + 1);

      // Copy post URL to clipboard
      const postUrl = `${window.location.origin}/post/${post.id}`;
      await navigator.clipboard.writeText(postUrl);

      toast({
        title: "Post shared!",
        description: "Post link copied to clipboard.",
      });

      onEngagementChange?.();
    } catch (error) {
      console.error('Error sharing post:', error);
      toast({
        title: "Error",
        description: typeof error === 'object' && error && 'message' in error
          ? String((error as any).message)
          : `Failed to share post. ${JSON.stringify(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleComment = () => {
  const commentButton = document.getElementById(`comment-input-${post.id}`);
  if (commentButton) commentButton.focus();
  };


  return (
    <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
      <div className="flex gap-1 sm:gap-4">
        <Button
          variant="ghost"
          size="sm"
          className={`flex items-center gap-1.5 px-2 ${isLiked ? 'text-red-500' : ''}`}
          onClick={handleLike}
          disabled={isLoading}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
          <span className="hidden sm:inline">{likesCount} {likesCount === 1 ? 'Like' : 'Likes'}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-2"
          onClick={handleComment}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">{commentsCount} {commentsCount === 1 ? 'Comment' : 'Comments'}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 px-2"
          onClick={handleShare}
          disabled={isLoading}
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">{sharesCount} {sharesCount === 1 ? 'Share' : 'Shares'}</span>
        </Button>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        className={`flex items-center gap-1.5 px-2 ${isBookmarked ? 'text-yellow-500' : ''}`}
        onClick={handleBookmark}
        disabled={isLoading}
      >
        <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
        <span className="hidden sm:inline">{bookmarksCount} {bookmarksCount === 1 ? 'Save' : 'Saves'}</span>
      </Button>
    </div>
  );
}
