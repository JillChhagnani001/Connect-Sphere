
// @ts-nocheck
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Image as ImageIcon, Video, FileText, MapPin, Smile, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { getBucketOrThrow } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfile } from "@/lib/types";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  initialTab?: 'post' | 'thread';
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export function CreatePostModal({ isOpen, onClose, onPostCreated, initialTab = 'post' }: CreatePostModalProps) {
  const [postType, setPostType] = useState<'post' | 'thread'>(initialTab);
  const [text, setText] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [isLoading, setIsLoading] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setPostType(initialTab);
  }, [initialTab]);

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
    if (postType === 'post' && mediaFiles.length === 0) {
      toast({ title: "Image Required", description: "Please upload an image for your post.", variant: "destructive" });
      return;
    }
    if (postType === 'thread' && !text.trim()) {
      toast({ title: "Content Required", description: "Please write some content for your thread.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      const { error: testError } = await supabase.from('posts').select('id').limit(1);
      if (testError) throw new Error(`Posts table error: ${JSON.stringify(testError)}`);

      let mediaUrls: any[] = [];
      if (mediaFiles.length > 0) {
        mediaUrls = await Promise.all(
          mediaFiles.map(async (mediaFile) => {
            const url = await uploadMedia(mediaFile.file);
            return { url, mime_type: mediaFile.file.type };
          })
        );
      }

      const postData: any = {
        user_id: user.id,
        text: text.trim(),
        media: mediaUrls.length > 0 ? mediaUrls : null,
        // The 'type' column does not exist, so we remove it.
        // The distinction between post and thread will be based on whether `media` is present.
        visibility,
        location: location || null,
        hashtags: hashtags.length > 0 ? hashtags : null,
      };

      const { data: insertData, error } = await supabase.from('posts').insert(postData).select();
      if (error) throw new Error(`Post creation error: ${JSON.stringify(error)}`);

      toast({
        title: postType === 'post' ? "Post Created!" : "Thread Posted!",
        description: "Your content has been shared successfully.",
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
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
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
        <Tabs value={postType} onValueChange={(value) => setPostType(value as any)} className="w-full">
          <DialogHeader>
            <DialogTitle>Create New Content</DialogTitle>
             <TabsList className="grid w-full grid-cols-2 mt-4">
              <TabsTrigger value="post">Post (Image + Caption)</TabsTrigger>
              <TabsTrigger value="thread">Thread (Text Only)</TabsTrigger>
            </TabsList>
          </DialogHeader>

          <TabsContent value="post" className="space-y-4 pt-4">
             {/* Media Upload */}
            <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                    {mediaFiles.length === 0 ? (
                        <div className="space-y-2">
                             <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">Drag & drop an image or video</p>
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Select from computer</Button>
                        </div>
                    ): (
                         <div className="grid grid-cols-2 gap-2">
                            {mediaFiles.map((media, index) => (
                            <div key={index} className="relative group">
                                <Image src={media.preview} alt="Preview" width={200} height={200} className="w-full h-32 object-cover rounded-lg" />
                                <Button size="sm" variant="destructive" className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeMedia(index)}>
                                <X className="h-3 w-3" />
                                </Button>
                            </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Caption Input */}
            <Textarea
              placeholder="Write a caption..."
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isLoading}
            />
            {/* Other inputs like location, collabs etc. can be added here */}
          </TabsContent>

          <TabsContent value="thread" className="space-y-4 pt-4">
            <Textarea
              placeholder="What's on your mind?"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[200px] resize-none"
              disabled={isLoading}
            />
          </TabsContent>

          {/* Common Action Buttons */}
          <div className="flex items-center justify-end pt-4 border-t space-x-2">
             <Button variant="outline" onClick={handleClose} disabled={isLoading}>Cancel</Button>
             <Button onClick={createPost} disabled={isLoading}>
                {isLoading ? "Posting..." : (postType === 'post' ? "Post" : "Post Thread")}
             </Button>
          </div>
        </Tabs>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleMediaSelect}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
