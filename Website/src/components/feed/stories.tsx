"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, Clock, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StoriesReactions } from "./stories-reactions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Story, UserProfile } from "@/lib/types";

export function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    fetchStories();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id);
  };

  const fetchStories = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Get stories from followed users and current user
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          author:profiles(*)
        `)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStories(data as Story[] || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
      toast({
        title: "Error",
        description: "Failed to load stories.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStory = () => {
    // This would open a story creation modal
    toast({
      title: "Create Story",
      description: "Story creation feature will be implemented soon.",
    });
  };

  const handleStoryClick = (story: Story) => {
    setSelectedStory(story);
  };

  const isExpired = (story: Story) => {
    return new Date(story.expires_at) < new Date();
  };

  const getStoryBorderColor = (story: Story) => {
    if (isExpired(story)) return "border-muted-foreground";
    return "border-primary";
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {/* Add Story Button */}
            <div className="flex-shrink-0">
              <div className="relative">
                <Avatar 
                  className="h-16 w-16 border-2 border-dashed border-muted-foreground cursor-pointer hover:border-primary transition-colors"
                  onClick={handleCreateStory}
                >
                  <AvatarFallback className="bg-muted">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="text-xs text-center mt-1 text-muted-foreground">Your Story</p>
            </div>

            {/* Stories */}
            {isLoading ? (
              <div className="flex items-center justify-center h-16 w-16">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : stories.length === 0 ? (
              <div className="flex items-center justify-center h-16 w-16 text-muted-foreground">
                <p className="text-xs">No stories</p>
              </div>
            ) : (
              stories.map((story) => (
                <div key={story.id} className="flex-shrink-0">
                  <div className="relative">
                    <Avatar 
                      className={`h-16 w-16 border-2 cursor-pointer ${getStoryBorderColor(story)}`}
                      onClick={() => handleStoryClick(story)}
                    >
                      <AvatarImage src={story.author.avatar_url} alt={story.author.display_name} />
                      <AvatarFallback>{story.author.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {isExpired(story) && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center mt-1 truncate w-16">
                    {story.author.display_name}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Story Viewer Modal */}
      <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedStory?.author.avatar_url} alt={selectedStory?.author.display_name} />
                <AvatarFallback>{selectedStory?.author.display_name.charAt(0)}</AvatarFallback>
              </Avatar>
              {selectedStory?.author.display_name}
              <span className="text-sm text-muted-foreground">
                {selectedStory && formatDistanceToNow(new Date(selectedStory.created_at), { addSuffix: true })}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedStory && (
            <div className="space-y-4">
              {/* Story Media */}
              <div className="relative aspect-square rounded-lg overflow-hidden">
                {selectedStory.media_url.includes('video') ? (
                  <video
                    src={selectedStory.media_url}
                    className="w-full h-full object-cover"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedStory.media_url}
                    alt="Story"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Story Text */}
              {selectedStory.text && (
                <p className="text-sm">{selectedStory.text}</p>
              )}

              {/* Story Reactions */}
              <StoriesReactions
                story={selectedStory}
                currentUserId={currentUserId}
                onReactionChange={() => {
                  // Refresh story data
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
