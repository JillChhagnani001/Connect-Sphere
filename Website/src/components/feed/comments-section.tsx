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

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Quick table access check to provide clearer errors
      const { error: tableError } = await supabase
        .from('comments')
        .select('id')
        .limit(1);

      if (tableError) {
        throw new Error(`Comments table error: ${JSON.stringify(tableError)}`);
      }

      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles(*)
        `)
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch replies for each comment
      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: replies } = await supabase
            .from('comments')
            .select(`
              *,
              author:profiles(*)
            `)
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true });

          return {
            ...comment,
            replies: replies || []
          };
        })
      );

      setComments(commentsWithReplies as Comment[]);
      onCommentCountChange?.(commentsWithReplies.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error",
        description: typeof error === 'object' && error && 'message' in error
          ? String((error as any).message)
          : `Failed to load comments. ${JSON.stringify(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Quick table access checks
      const { error: commentsTblErr } = await supabase.from('comments').select('id').limit(1);
      if (commentsTblErr) {
        throw new Error(`Comments table error: ${JSON.stringify(commentsTblErr)}`);
      }

      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          text: newComment.trim(),
          parent_id: replyingTo,
        });

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
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Heart className="h-3 w-3 mr-1" />
              Like
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
          <Button variant="ghost" size="sm">
            <Smile className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
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
          <div className="space-y-2">
            {replyingTo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Replying to comment</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                  className="h-6 px-2"
                >
                  Cancel
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>U</AvatarFallback>
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
