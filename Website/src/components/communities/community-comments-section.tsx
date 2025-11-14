"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/hooks/use-user";

interface CommunityComment {
  id: number;
  post_id: number;
  user_id: string;
  text: string;
  created_at: string;
  parent_id?: number | null;
  author: {
    id: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  };
  replies?: CommunityComment[];
}

interface Props {
  postId: number;
  onCountChange?: (count: number) => void;
}

export function CommunityCommentsSection({ postId, onCountChange }: Props) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
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
      const { data: parents, error } = await supabase
        .from("community_post_comments")
        .select(
          `*, author:profiles!community_post_comments_user_id_fkey(id, display_name, username, avatar_url)`
        )
        .eq("post_id", postId)
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const parentComments = parents as any[] || [];
      const withReplies: CommunityComment[] = [];
      for (const p of parentComments) {
        const { data: replies } = await supabase
          .from("community_post_comments")
          .select(
            `*, author:profiles(id, display_name, username, avatar_url)`
          )
          .eq("parent_id", p.id)
          .order("created_at", { ascending: true });
        withReplies.push({ ...p, replies: (replies as any[]) || [] });
      }
      setComments(withReplies);
      onCountChange?.(withReplies.length);
    } catch (e) {
      console.error(e);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile?.id || !newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("community_post_comments").insert({
        post_id: postId,
        user_id: profile.id,
        text: newComment.trim(),
        parent_id: replyingTo,
      });
      if (error) throw error;
      setNewComment("");
      setReplyingTo(null);
      await fetchComments();
      toast({ title: "Comment posted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to post comment", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderComment = (c: CommunityComment, isReply = false) => (
    <div key={c.id} className={isReply ? "ml-8 mt-2" : ""}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={c.author?.avatar_url || undefined} />
          <AvatarFallback>{(c.author?.display_name || "U").charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{c.author?.display_name || "User"}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm">{c.text}</p>
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
            >
              Reply
            </Button>
          )}
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
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No comments yet.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id}>
                {renderComment(c)}
                {c.replies && c.replies.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {c.replies.map((r) => renderComment(r, true))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {profile?.id && (
          <div className="space-y-2 pt-4 border-t">
            {replyingTo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Replying to a comment</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setReplyingTo(null)}>
                  Cancel
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{(profile.display_name || "U").charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] resize-none"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim() || isSubmitting}>
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
