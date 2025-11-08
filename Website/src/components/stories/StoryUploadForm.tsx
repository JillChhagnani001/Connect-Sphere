"use client";

import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadStory } from '@/lib/supabase/story-upload';

interface StoryUploadFormProps {
  currentUserId: string;
  onStoryUploaded: () => void;
}

export function StoryUploadForm({ currentUserId, onStoryUploaded }: StoryUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  if (!currentUserId) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // --- File validation logic goes here if needed ---

    setIsUploading(true);

    try {
      await uploadStory(file, currentUserId);

      toast({
        title: "Story Uploaded!",
        description: "Your story is live for 24 hours.",
      });

      onStoryUploaded();

    } catch (error: any) { // Catching the error thrown by uploadStory
      // The error.message should now contain the specific Supabase upload failure reason
      console.error("Story Upload Error:", error.message || error);
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload story. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      <button
        onClick={handleClick}
        disabled={isUploading}
        className={`
          w-16 h-16 rounded-full border-2 border-dashed border-gray-400 
          flex items-center justify-center relative transition-opacity
          ${isUploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'}
        `}
      >
        {isUploading ? (
          <span className="animate-pulse text-xs text-gray-400">Uploading...</span>
        ) : (
          <Plus className="w-6 h-6 text-gray-400" />
        )}
      </button>
      <span className="text-xs mt-1 text-center font-medium">Your Story</span>
    </div>
  );
}