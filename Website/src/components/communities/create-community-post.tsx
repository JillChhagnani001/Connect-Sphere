"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreateCommunityPostProps {
  communityId: number;
  isPremiumMember?: boolean;
  userProfile?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export function CreateCommunityPost({ communityId, isPremiumMember = false, userProfile }: CreateCommunityPostProps) {
  const [text, setText] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      // Only allow premium posts if user is a premium member
      const finalIsPremium = isPremium && isPremiumMember;

      const { error } = await supabase
        .from('community_posts')
        .insert({
          community_id: communityId,
          user_id: user.id,
          text: text.trim(),
          is_premium: finalIsPremium,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Post created successfully!",
      });

      setText("");
      setIsPremium(false);
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
                onChange={(e) => setText(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isLoading}
              />
              {isPremiumMember && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="premium"
                    checked={isPremium}
                    onCheckedChange={(checked) => setIsPremium(checked as boolean)}
                  />
                  <Label htmlFor="premium" className="flex items-center gap-2 cursor-pointer">
                    <Crown className="h-4 w-4" />
                    <span>Mark as premium content</span>
                  </Label>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || !text.trim()}>
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

