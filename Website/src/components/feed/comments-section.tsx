"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Reply, MoreHorizontal, Heart, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Comment, UserProfile } from "@/lib/types";
import { useUser } from "@/hooks/use-user";

interface CommentsSectionProps {
  postId: number;
  currentUserId?: string;
  onCommentCountChange?: (count: number) => void;
}

export function CommentsSection({ postId, currentUserId, onCommentCountChange }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useUser();

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      // 1. Fetch main parent comments
      const { data: parentCommentsData, error } = await supabase
        .from('comments')
        .select(`
                  *,
                  author:profiles!comments_user_id_fkey(*),
                  like_count 
              `)
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;


      const parentComments = parentCommentsData || [];
      const commentIds = parentComments.map(c => c.id);



      // 2. Fetch LIKE STATUS for all parent comments
      let likedCommentIds: number[] = [];
      if (currentUserId && commentIds.length > 0) {
        const { data: likedData } = await supabase
          .from('comment_likes')

          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', currentUserId);

        likedCommentIds = likedData ? likedData.map(l => l.comment_id) : [];
      }

      // 3. Fetch replies and stitch everything together (Nested stable logic)
      const commentsWithReplies = await Promise.all(
        parentComments.map(async (comment) => {

          // Determine has_liked for the parent comment
          const parentHasLiked = likedCommentIds.includes(comment.id);

          // --- FETCH REPLIES ---
          const { data: repliesData } = await supabase
            .from('comments')
            .select(`
                          *,
                          author:profiles(*),
                          like_count 
                      `)
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true });

          const replies = repliesData || [];

          
          const replyIds = replies.map(r => r.id);
          let likedReplyIds: number[] = [];

          if (currentUserId && replyIds.length > 0) {
            const { data: likedRepliesData } = await supabase
              .from('comment_likes')
              .select('comment_id')
              .in('comment_id', replyIds)
              .eq('user_id', currentUserId);
            likedReplyIds = likedRepliesData ? likedRepliesData.map(l => l.comment_id) : [];
          }

          const repliesWithLikeStatus = replies.map(reply => ({
            ...reply,
            has_liked: likedReplyIds.includes(reply.id),
            like_count: reply.like_count ?? 0, // Ensure safe default
          })) as Comment[];

          return {
            ...comment,
            has_liked: parentHasLiked, // Add has_liked status to parent
            replies: repliesWithLikeStatus,
            like_count: comment.like_count ?? 0, // Ensure safe default for parent
          } as Comment;
        })
      );

      setComments(commentsWithReplies);
      onCommentCountChange?.(commentsWithReplies.length);

    } catch (error) {
      console.error('Final Fetch Error:', error);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          text: newComment.trim(),
          parent_id: replyingTo,
        });
      if (!error) {
        // Increment the comment count on the parent post
        await supabase.rpc('increment_comment_count', { post_id_input: postId });
      }

      if (error) throw error;

      setNewComment("");
      setReplyingTo(null);
      fetchComments(); // Refresh comments

      toast({
        title: "Comment posted!",
        description: "Your comment has been added.",
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: typeof error === 'object' && error && 'message' in error
          ? String((error as any).message)
          : `Failed to post comment. ${JSON.stringify(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const toggleCommentLike = async (commentId: number, hasLiked: boolean) => {
    if (!currentUserId) {
      toast({ title: "Login required", description: "You must be logged in to like comments.", variant: "destructive" });
      return;
    }

    const supabase = createClient();
    try {
      if (hasLiked) {
        // Unlike: Delete the row
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);
      } else {
        // Like: Insert a new row
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: currentUserId,
          });
      }

      // Refresh comments to update the counts and icons
      fetchComments();

    } catch (error) {
      console.error('Error toggling comment like:', error);
      toast({ title: "Error", description: "Failed to toggle like status.", variant: "destructive" });
    }
  };
  const handleReply = (commentId: number) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 mt-2' : ''}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author.avatar_url} alt={comment.author.display_name} />
          <AvatarFallback>{comment.author.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{comment.author.display_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm">{comment.text}</p>
          <div className="flex items-center gap-4">

            
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 text-xs ${comment.has_liked ? 'text-red-500 hover:text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => toggleCommentLike(comment.id, comment.has_liked)}
              disabled={!currentUserId}
            >
              <Heart
                className={`h-3 w-3 mr-1 ${comment.has_liked ? 'fill-red-500' : ''}`} // Fill heart if liked
              />
              {comment.like_count > 0 ? `${comment.like_count} ${comment.like_count === 1 ? 'Like' : 'Likes'}` : 'Like'}
            </Button>
            

            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => handleReply(comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id}>
                {renderComment(comment)}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {comment.replies.map((reply) => renderComment(reply, true))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        {currentUserId && (
          <div className="space-y-2 pt-4 border-t">
            {replyingTo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Replying to a comment</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                  className="h-6 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url} alt={profile?.display_name} />
                <AvatarFallback>{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmitting}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Posting..." : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
