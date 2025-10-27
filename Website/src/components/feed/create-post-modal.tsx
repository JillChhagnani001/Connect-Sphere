"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Image as ImageIcon, Video, FileText, MapPin, Smile, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { getBucketOrThrow } from "@/lib/utils";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [text, setText] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [isLoading, setIsLoading] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const extractHashtags = (text: string) => {
    const hashtagRegex = /#[\w]+/g;
    return text.match(hashtagRegex) || [];
  };

  const handleTextChange = (value: string) => {
    setText(value);
    const extractedHashtags = extractHashtags(value);
    setHashtags(extractedHashtags);
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const mediaFile: MediaFile = {
            file,
            preview: e.target?.result as string,
            type: file.type.startsWith('image/') ? 'image' : 'video'
          };
          setMediaFiles(prev => [...prev, mediaFile]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadMedia = async (file: File): Promise<string> => {
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const bucket = getBucketOrThrow('media');
    const filePath = `posts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      if ((uploadError as any)?.name === 'StorageApiError') {
        throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage or set NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET env.`);
      }
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createPost = async () => {
    if (!text.trim() && mediaFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please add some content to your post.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      console.log('Creating post for user:', user?.id);

      if (!user) {
        throw new Error("User not authenticated");
      }

      // Check if posts table exists
      console.log('Checking posts table...');
      const { data: testData, error: testError } = await supabase
        .from('posts')
        .select('id')
        .limit(1);

      console.log('Posts table test:', testData, testError);

      if (testError) {
        throw new Error(`Posts table error: ${JSON.stringify(testError)}`);
      }

      // Upload media files
      let mediaUrls: any[] = [];
      if (mediaFiles.length > 0) {
        console.log('Uploading media files...');
        mediaUrls = await Promise.all(
          mediaFiles.map(async (mediaFile) => {
            const url = await uploadMedia(mediaFile.file);
            return {
              url,
              mime_type: mediaFile.file.type,
              width: mediaFile.type === 'image' ? 800 : undefined,
              height: mediaFile.type === 'image' ? 600 : undefined,
            };
          })
        );
        console.log('Media uploaded:', mediaUrls);
      }

      // Build post data with only basic fields first
      const postData: any = {
        user_id: user.id,
        text: text.trim(),
      };

      // Only add fields that might exist in the posts table
      if (mediaUrls.length > 0) {
        postData.media = mediaUrls;
      }
      if (location) {
        postData.location = location;
      }
      if (hashtags.length > 0) {
        postData.hashtags = hashtags;
      }

      // Check if visibility columns exist by trying a simple query
      try {
        const { data: visibilityTest } = await supabase
          .from('posts')
          .select('visibility')
          .limit(1);
        
        if (visibilityTest !== null) {
          postData.visibility = visibility;
          postData.is_private = visibility === 'private';
        }
      } catch (e) {
        console.log('Visibility columns not available, skipping...');
      }

      console.log('Creating post with data:', postData);

      // Create post
      const { data: insertData, error } = await supabase
        .from('posts')
        .insert(postData)
        .select();

      console.log('Post creation result:', insertData, error);

      if (error) {
        throw new Error(`Post creation error: ${JSON.stringify(error)}`);
      }

      toast({
        title: "Post Created!",
        description: "Your post has been shared successfully.",
      });

      // Reset form
      setText("");
      setMediaFiles([]);
      setHashtags([]);
      setLocation("");
      setVisibility('public');
      onPostCreated();
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      
      let errorMessage = "Failed to create post. Please try again.";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `Error: ${error.message}`;
      } else if (error && typeof error === 'string') {
        errorMessage = `Error: ${error}`;
      } else if (error) {
        errorMessage = `Error: ${JSON.stringify(error)}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
          <DialogDescription>
            Share your thoughts, photos, and videos with your network.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <Textarea
              placeholder="What's on your mind?"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isLoading}
            />
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((hashtag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {hashtag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Media Preview */}
          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Media Preview</h4>
              <div className="grid grid-cols-2 gap-2">
                {mediaFiles.map((media, index) => (
                  <div key={index} className="relative group">
                    {media.type === 'image' ? (
                      <Image
                        src={media.preview}
                        alt="Preview"
                        width={200}
                        height={200}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <video
                        src={media.preview}
                        className="w-full h-32 object-cover rounded-lg"
                        controls
                      />
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMedia(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Add location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Visibility Settings */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Who can see this post?</label>
            <Select value={visibility} onValueChange={(value: 'public' | 'followers' | 'private') => setVisibility(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - Anyone can see this post</SelectItem>
                <SelectItem value="followers">Followers - Only your followers can see this post</SelectItem>
                <SelectItem value="private">Private - Only you can see this post</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Photo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </Button>
              <Button variant="outline" size="sm" disabled={isLoading}>
                <Smile className="h-4 w-4 mr-2" />
                Emoji
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={createPost} disabled={isLoading || (!text.trim() && mediaFiles.length === 0)}>
                {isLoading ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleMediaSelect}
            className="hidden"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
