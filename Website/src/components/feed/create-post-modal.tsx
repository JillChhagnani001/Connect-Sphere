// @ts-nocheck
"use client";

import { useState, useRef } from "react";
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
  const [collabQuery, setCollabQuery] = useState("");
  const [collabResults, setCollabResults] = useState<any[]>([]);
  const [selectedCollabs, setSelectedCollabs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const searchProfiles = async (q: string) => {
    try {
      if (!q || q.trim().length < 2) {
        setCollabResults([]);
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);

      if (error) {
        console.error('Profile search error', error);
        setCollabResults([]);
        return;
      }

      // filter out already selected and current user if present
      const filtered = (data || []).filter((p: any) => !selectedCollabs.find(s => s.id === p.id));
      setCollabResults(filtered);
    } catch (e) {
      console.error('searchProfiles error', e);
      setCollabResults([]);
    }
  };

  const addSelectedCollab = (profile: any) => {
    // avoid duplicates
    if (selectedCollabs.find((s: any) => s.id === profile.id)) return;
    setSelectedCollabs((prev: any[]) => [...prev, profile]);
    setCollabResults((prev: any[]) => prev.filter((p: any) => p.id !== profile.id));
    setCollabQuery("");
  };

  const removeSelectedCollab = (id: string) => {
    setSelectedCollabs((prev: any[]) => prev.filter((p: any) => p.id !== id));
  };

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

      // Add collaborators if selected
      if (selectedCollabs.length > 0) {
        postData.collaborators = selectedCollabs.map((u: any) => ({
          user_id: u.id,
          role: 'coauthor',
          accepted: true,
          invited_at: new Date().toISOString(),
        }));
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

      // If there are selected collaborators, create collaboration invites
      if (selectedCollabs.length > 0) {
        try {
          const invitesPayload = selectedCollabs.map((u: any) => ({
            post_id: insertData[0].id,
            inviter_id: user.id,
            invitee_id: u.id,
            role: 'coauthor',
            status: 'pending',
            invited_at: new Date().toISOString(),
          }));

          const { error: inviteError } = await supabase
            .from('collaboration_invites')
            .insert(invitesPayload);

          if (inviteError) {
            // Table may not exist or other DB issue — surface to the user but don't block post creation
            console.warn('Failed to create collaboration invites:', inviteError);
            toast({ title: 'Invites not sent', description: 'Collaborator invites could not be created. Ensure the collaboration_invites table exists.', variant: 'destructive' });
          } else {
            toast({ title: 'Invites sent', description: 'Collaboration invites were sent to your collaborators.' });
          }
        } catch (e) {
          console.error('Error creating invites', e);
          toast({ title: 'Invites not sent', description: 'An error occurred while sending invites.', variant: 'destructive' });
        }
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

                  {/* Collaborators - search and select */}
                  <div className="space-y-2">
                <label className="text-sm font-medium">Add collaborators</label>
                <div>
                  <Input
                    placeholder="Search by username or name (min 2 chars)"
                    value={collabQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCollabQuery(v);
                      searchProfiles(v);
                    }}
                    disabled={isLoading}
                  />

                  {/* Selected collaborators */}
                  {selectedCollabs.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {selectedCollabs.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-full text-sm">
                          {c.avatar_url ? (
                            // small avatar
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.avatar_url} alt={c.display_name} className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">{c.display_name?.[0]}</div>
                          )}
                          <span>{c.display_name || c.username}</span>
                          <Button size="sm" variant="ghost" onClick={() => removeSelectedCollab(c.id)}>Remove</Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search results dropdown */}
                  {collabResults.length > 0 && (
                    <div className="mt-2 border rounded-md bg-background shadow-md max-h-48 overflow-auto">
                      {collabResults.map((r) => (
                        <div key={r.id} className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2" onClick={() => addSelectedCollab(r)}>
                          {r.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatar_url} alt={r.display_name} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-sm">{r.display_name?.[0]}</div>
                          )}
                          <div className="flex flex-col text-sm">
                            <span className="font-medium">{r.display_name}</span>
                            <span className="text-xs text-muted-foreground">@{r.username}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
          

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
