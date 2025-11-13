"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface CreateCommunityPostProps {
  communityId: number;
  canPost?: boolean;
  userProfile?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export function CreateCommunityPost({ communityId, canPost = false, userProfile }: CreateCommunityPostProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!canPost) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "Only owners and co-owners can create posts in this community.",
      });
      return;
    }

    if (!text.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter some content for your post",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "You must be logged in to create posts",
        });
        return;
      }

      const { data: membership } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'co_owner')) {
        toast({
          variant: "destructive",
          title: "Permission denied",
          description: "Only owners and co-owners can create posts in this community.",
        });
        return;
      }

      const { error } = await supabase
        .from('community_posts')
        .insert({
          community_id: communityId,
          user_id: user.id,
          text: text.trim(),
          is_premium: false,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Post created successfully!",
      });

      setText("");
      router.refresh();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create post",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.display_name || 'User'} />
              <AvatarFallback>{userProfile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={text}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isLoading || !canPost}
              />
              {!canPost && (
                <p className="text-sm text-muted-foreground">
                  Only community owners and co-owners can create posts.
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || !text.trim() || !canPost}>
                  {isLoading ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

