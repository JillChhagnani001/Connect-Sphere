"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, Clock, Eye, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StoriesReactions } from "./stories-reactions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Story, UserProfile } from "@/lib/types";
import { fetchActiveStories } from '@/lib/supabase/story-fetch';
import { StoryUploadForm } from '@/components/stories/StoryUploadForm';

export function Stories() {
  const [stories, setStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id);
    if (user?.id) {
      // Pass the ID directly to avoid state lag
      fetchStories(user.id);
    }
  };

  const fetchStories = async (userId: string | undefined = currentUserId) => { // Accept ID as argument
    // ... (rest of function)
    try {
      if (!userId) { // Use the argument here
        setStories([]);
        return;
      }

      const groupedStories = await fetchActiveStories(userId);

      // Sort: Ensure the current user's story is always first, if present
      const sortedStories = groupedStories.sort((a, b) => {
        if (a.isOwner) return -1; // Owner first
        if (b.isOwner) return 1;
        return 0;
      });

      setStories(sortedStories as StoryGroup[]);

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
    const handleDeleteStory = async () => {
    if (!selectedStory || selectedStory.user_id !== currentUserId) {
      toast({ title: "Error", description: "You can only delete your own stories.", variant: "destructive" });
      return;
    }
      // We should use a confirmation modal here for real apps, but for simplicity, we proceed.

    const supabase = createClient();
    const storyIdToDelete = selectedStory.id;
    const storyMediaUrl = selectedStory.media_url;

    try {
      setIsLoading(true);
      setSelectedStory(null); // Close modal immediately

      // 1. Delete record from the 'stories' table (RLS should ensure only the owner can delete)
      const { error: dbError } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyIdToDelete);

      if (dbError) throw dbError;

      // 2. Delete file from Supabase Storage
      // This logic extracts the path from the full URL string
      const urlParts = storyMediaUrl.split('/');
      const bucketIndex = urlParts.indexOf('stories');
      const filePath = urlParts.slice(bucketIndex + 1).join('/');

      const { error: storageError } = await supabase.storage
        .from('stories')
        .remove([filePath]);

      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
      }

      toast({
        title: "Story Deleted",
        description: "The story has been permanently removed.",
      });

      // 3. Refresh the story list
      fetchStories(currentUserId);

    } catch (error: any) {
      console.error('Error deleting story:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete story. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">



          <div className="flex gap-4 overflow-x-auto pb-2">

            {/* 1. RENDER OWNER'S ACTIVE STORY / ADD STORY BUTTON */}
            {stories.length > 0 && stories[0].isOwner ? (
              // If the owner has an active story and profile data exists
              <div className="flex-shrink-0">
                <div className="flex flex-col items-center">
                  <Avatar
                    className={`h-16 w-16 border-2 border-primary cursor-pointer`}
                    onClick={() => handleStoryClick(stories[0].stories[0])}
                  >
                    {/* Defensive Check: Ensure profile and avatar_url exist */}
                    {stories[0].profile && stories[0].profile.avatar_url ? (
                      <AvatarImage src={stories[0].profile.avatar_url} alt="Your Story" />
                    ) : (
                      // Fallback for avatar image
                      <AvatarFallback>
                        {stories[0].profile?.display_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <p className="text-xs text-center mt-1 font-medium">Your Story</p>
                </div>
              </div>
            ) : (
              // If the owner has NO active story, show the Add button
              <div className="flex-shrink-0">
                <StoryUploadForm
                  currentUserId={currentUserId!}
                  // CORRECT: Use a wrapper function to call fetchStories with the current user ID
                  onStoryUploaded={() => fetchStories(currentUserId!)}
                />
              </div>
            )}

            {/* 2. RENDER STORIES FROM FOLLOWED USERS */}
            {isLoading ? (
              <div className="flex items-center justify-center h-16 w-16">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              stories
                // CRITICAL FILTER: Only map groups that are not the owner AND have a valid profile object
                .filter(g => !g.isOwner && g.profile)
                .map((group) => (
                  <div key={group.profile.id} className="flex-shrink-0">
                    <div className="relative">
                      <Avatar
                        className={`h-16 w-16 border-2 cursor-pointer ${getStoryBorderColor(group.stories[0])}`}
                        onClick={() => handleStoryClick(group.stories[0])}
                      >
                        {/* Defensive Check: Ensure avatar_url exists */}
                        {group.profile.avatar_url ? (
                          <AvatarImage src={group.profile.avatar_url} alt={group.profile.display_name} />
                        ) : (
                          <AvatarFallback>{group.profile.display_name?.charAt(0)||"U"}</AvatarFallback>
                        )}
                      </Avatar>
                    </div>
                    <p className="text-xs text-center mt-1 truncate w-16">
                      {group.profile.display_name}
                    </p>
                  </div>
                ))
            )}

            {/* Placeholder for when there are NO stories AT ALL */}
            {!isLoading && stories.length === 0 && currentUserId && (
              <div className="flex items-center justify-center h-16 w-16 text-muted-foreground">
                <p className="text-xs">No stories</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Story Viewer Modal */}
      <Dialog open={!!selectedStory} onOpenChange={setSelectedStory}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="flex items-center gap-2">
                {/* Author Info */}
                {selectedStory?.author && (
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={selectedStory.author.avatar_url ?? 'DEFAULT_URL'}
                      alt={selectedStory.author.display_name}
                    />
                    <AvatarFallback>{selectedStory.author.display_name?.charAt(0) ?? 'U'}</AvatarFallback>
                  </Avatar>
                )}
                <span className="font-semibold">{selectedStory?.author?.display_name}</span>
                <span className="text-sm text-muted-foreground font-normal">
                  {selectedStory && formatDistanceToNow(new Date(selectedStory.created_at), { addSuffix: true })}
                </span>
              </DialogTitle>

              {/* Delete Button (Visible only to owner) */}
              {selectedStory && selectedStory.user_id === currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteStory}
                  className="text-red-500 hover:text-red-600"
                  title="Delete Story"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
            </div>
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
                  // Refresh story data after reaction to see new counts
                  fetchStories(currentUserId);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
