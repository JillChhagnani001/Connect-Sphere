"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Smile, Laugh, ThumbsUp, Frown, Angry } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Story, StoryReaction } from "@/lib/types";

interface StoriesReactionsProps {
  story: Story;
  currentUserId?: string;
  onReactionChange?: () => void;
}

const reactionTypes = [
  { type: 'like', icon: Heart, label: 'Like', color: 'text-red-500' },
  { type: 'love', icon: Heart, label: 'Love', color: 'text-pink-500' },
  { type: 'laugh', icon: Laugh, label: 'Laugh', color: 'text-yellow-500' },
  { type: 'wow', icon: Smile, label: 'Wow', color: 'text-blue-500' },
  { type: 'sad', icon: Frown, label: 'Sad', color: 'text-gray-500' },
  { type: 'angry', icon: Angry, label: 'Angry', color: 'text-red-600' },
] as const;

export function StoriesReactions({ story, currentUserId, onReactionChange }: StoriesReactionsProps) {
  const [userReaction, setUserReaction] = useState<StoryReaction | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUserId) {
      fetchUserReaction();
      fetchReactionCounts();
    }
  }, [currentUserId, story.id]);

  const fetchUserReaction = async () => {
    if (!currentUserId) return;

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('story_reactions')
        .select('*')
        .eq('story_id', story.id)
        .eq('user_id', currentUserId)
        .single();

      setUserReaction(data);
    } catch (error) {
      // User hasn't reacted yet
      setUserReaction(null);
    }
  };

  const fetchReactionCounts = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('story_reactions')
        .select('reaction_type')
        .eq('story_id', story.id);

      if (data) {
        const counts = data.reduce((acc, reaction) => {
          acc[reaction.reaction_type] = (acc[reaction.reaction_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setReactionCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching reaction counts:', error);
    }
  };

  const handleReaction = async (reactionType: string) => {
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to react to stories.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      if (userReaction?.reaction_type === reactionType) {
        // Remove reaction
        const { error } = await supabase
          .from('story_reactions')
          .delete()
          .eq('story_id', story.id)
          .eq('user_id', currentUserId);

        if (error) throw error;

        setUserReaction(null);
        setReactionCounts(prev => ({
          ...prev,
          [reactionType]: Math.max(0, (prev[reactionType] || 0) - 1)
        }));
      } else {
        // Add or change reaction
        const { error } = await supabase
          .from('story_reactions')
          .upsert({
            story_id: story.id,
            user_id: currentUserId,
            reaction_type: reactionType,
          });

        if (error) throw error;

        // Update counts
        const oldReaction = userReaction?.reaction_type;
        const newCounts = { ...reactionCounts };

        if (oldReaction) {
          newCounts[oldReaction] = Math.max(0, (newCounts[oldReaction] || 0) - 1);
        }
        newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;

        setReactionCounts(newCounts);
        setUserReaction({
          id: 0, // Will be updated by the database
          story_id: story.id,
          user_id: currentUserId,
          reaction_type: reactionType as any,
          created_at: new Date().toISOString(),
        });
      }

      onReactionChange?.();
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast({
        title: "Error",
        description: "Failed to update reaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalReactions = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-3">
      {/* Reaction Buttons */}
      <div className="flex items-center gap-2">
        {reactionTypes.map(({ type, icon: Icon, label, color }) => {
          const isActive = userReaction?.reaction_type === type;
          const count = reactionCounts[type] || 0;

          return (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className={`flex items-center gap-1 h-8 px-2 ${isActive ? color : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => handleReaction(type)}
              disabled={isLoading}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'fill-current' : ''}`} />
              {count > 0 && (
                <Badge variant="secondary" className="h-5 px-1 text-xs">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Reaction Summary */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{totalReactions} reaction{totalReactions !== 1 ? 's' : ''}</span>
          {userReaction && (
            <Badge variant="outline" className="text-xs">
              You reacted with {reactionTypes.find(r => r.type === userReaction.reaction_type)?.label}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
