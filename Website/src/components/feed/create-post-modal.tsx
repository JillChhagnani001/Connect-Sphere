"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Image as ImageIcon, Video, MapPin, Smile, Hash, UserPlus, Loader2 } from "lucide-react";
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
  
  // Collaboration state
  const [collabQuery, setCollabQuery] = useState("");
  const [isSearchingCollab, setIsSearchingCollab] = useState(false);
  const [collabResults, setCollabResults] = useState<any[]>([]);
  const [selectedCollabs, setSelectedCollabs] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = createClient();

  const searchProfiles = async (q: string) => {
    if (!q || q.trim().length < 2) {
      setCollabResults([]);
      return;
    }
    setIsSearchingCollab(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', user?.id) // Don't find self
        .limit(5);

      if (!error && data) {
        // Filter out already selected profiles
        setCollabResults(data.filter(p => !selectedCollabs.some(s => s.id === p.id)));
      }
    } finally {
      setIsSearchingCollab(false);
    }
  };

  const addCollab = (profile: any) => {
    setSelectedCollabs([...selectedCollabs, profile]);
    setCollabQuery("");
    setCollabResults([]);
  };

  const removeCollab = (id: string) => {
    setSelectedCollabs(selectedCollabs.filter(c => c.id !== id));
  };

  const handleTextChange = (value: string) => {
    setText(value);
    setHashtags(value.match(/#[\w]+/g) || []);
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setMediaFiles(prev => [...prev, {
            file,
            preview: e.target?.result as string,
            type: file.type.startsWith('image/') ? 'image' : 'video'
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const uploadMedia = async (file: File) => {
    const bucket = getBucketOrThrow('media');
    const ext = file.name.split('.').pop();
    const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const createPost = async () => {
    if (!text.trim() && mediaFiles.length === 0) return;
    
    // Validate post content length
    if (text.length > 5000) {
      toast({ 
        title: "Content Too Long", 
        description: "Post content cannot exceed 5000 characters. Current length: " + text.length,
        variant: "destructive" 
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const mediaUrls = await Promise.all(mediaFiles.map(async (mf) => ({
        url: await uploadMedia(mf.file),
        mime_type: mf.file.type,
      })));

      const { data: post, error } = await supabase.from('posts').insert({
        user_id: user.id,
        text: text.trim(),
        media: mediaUrls,
        location,
        hashtags,
        visibility,
        is_private: visibility === 'private'
      }).select().single();

      if (error) throw error;

      if (selectedCollabs.length > 0) {
        const invites = selectedCollabs.map(c => ({
          post_id: post.id,
          inviter_id: user.id,
          invitee_id: c.id
        }));
        const { error: inviteError } = await supabase.from('collaboration_invites').insert(invites);
        if (inviteError) console.error("Error sending invites:", inviteError);
        else toast({ title: "Collaborators invited!" });
      }

      toast({ title: "Post created successfully!" });
      onPostCreated();
      onClose();
      // Reset form
      setText(""); setMediaFiles([]); setHashtags([]); setLocation(""); setSelectedCollabs([]);
    } catch (error: any) {
      toast({ title: "Error creating post", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for safe initials
  const getInitials = (name?: string | null) => (name || '?').charAt(0).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>Share with your community</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Textarea
            placeholder="What's on your mind?"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            className="min-h-[100px] resize-none border-none focus-visible:ring-0 p-0 text-base"
            disabled={isLoading}
          />
          
          {/* Media Previews */}
          {mediaFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mediaFiles.map((media, i) => (
                <div key={i} className="relative shrink-0 w-32 h-32 rounded-md overflow-hidden group">
                  {media.type === 'image' ? (
                    <Image src={media.preview} alt="" fill className="object-cover" />
                  ) : (
                    <video src={media.preview} className="w-full h-full object-cover" />
                  )}
                  <button
                    onClick={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Hash className="w-3 h-3 mr-1" />{tag.replace('#', '')}
                </Badge>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            {/* Collaboration Input */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {selectedCollabs.map(c => (
                  <Badge key={c.id} variant="outline" className="pl-1 pr-2 py-1 flex items-center gap-1">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={c.avatar_url} />
                      <AvatarFallback>{getInitials(c.username)}</AvatarFallback>
                    </Avatar>
                    {c.username || c.display_name}
                    <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeCollab(c.id)} />
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tag collaborators..."
                  value={collabQuery}
                  onChange={(e) => { setCollabQuery(e.target.value); searchProfiles(e.target.value); }}
                  className="h-8 text-sm border-none shadow-none focus-visible:ring-0 px-0"
                />
                {isSearchingCollab && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              {collabResults.length > 0 && collabQuery && (
                <div className="absolute top-full left-0 w-full bg-popover border rounded-md shadow-md mt-1 p-1 max-h-48 overflow-y-auto">
                  {collabResults.map(profile => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                      onClick={() => addCollab(profile)}
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback>{getInitials(profile.display_name || profile.username)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">{profile.display_name || 'Unknown'}</span>
                        {profile.username && <span className="text-xs text-muted-foreground">@{profile.username}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Location & Tools */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Add location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-8 text-sm border-none shadow-none focus-visible:ring-0 px-0"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                  <Video className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Smile className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                  <SelectTrigger className="h-8 text-xs w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="followers">Followers</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={createPost} disabled={isLoading || (!text.trim() && mediaFiles.length === 0)}>
                  {isLoading ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*,video/*"
          onChange={handleMediaSelect}
        />
      </DialogContent>
    </Dialog>
  );
}