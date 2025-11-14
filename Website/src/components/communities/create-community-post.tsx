"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Image as ImageIcon, Video, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBucketOrThrow } from "@/lib/utils";

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
  const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string; type: "image" | "video" }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    if (!text.trim() && mediaFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please add text or attach a photo/video",
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

      // Upload media if any
      let media: { url: string; mime_type: string }[] = [];
      if (mediaFiles.length > 0) {
        const bucket = getBucketOrThrow('media');
        const uploads = await Promise.all(mediaFiles.map(async (mf) => {
          const ext = mf.file.name.split('.').pop();
          const path = `community-posts/${communityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from(bucket).upload(path, mf.file);
          if (error) throw error;
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          return { url: data.publicUrl, mime_type: mf.file.type };
        }));
        media = uploads;
      }

      const { error } = await supabase
        .from('community_posts')
        .insert({
          community_id: communityId,
          user_id: user.id,
          text: text.trim() || null,
          media: media.length > 0 ? media : null,
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
      setMediaFiles([]);
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
              <Tabs defaultValue="text">
                <TabsList>
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="media">Photo/Video</TabsTrigger>
                </TabsList>
                <TabsContent value="text">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={text}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
                    className="min-h-[100px] resize-none"
                    disabled={isLoading || !canPost}
                  />
                </TabsContent>
                <TabsContent value="media">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Add Photo
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                        <Video className="h-4 w-4" />
                        Add Video
                      </Button>
                    </div>
                    {mediaFiles.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {mediaFiles.map((m, i) => (
                          <div key={i} className="relative shrink-0 w-28 h-28 rounded-md overflow-hidden group bg-muted">
                            {m.type === 'image' ? (
                              <Image src={m.preview} alt="" fill className="object-cover" />
                            ) : (
                              <video src={m.preview} className="w-full h-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const files = event.target.files;
                        if (!files) return;
                        Array.from(files).forEach((file) => {
                          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setMediaFiles(prev => [...prev, {
                                file,
                                preview: ev.target?.result as string,
                                type: file.type.startsWith('image/') ? 'image' : 'video'
                              }]);
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                        // reset input so same file can be re-selected if removed
                        event.currentTarget.value = "";
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              {!canPost && (
                <p className="text-sm text-muted-foreground">
                  Only community owners and co-owners can create posts.
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || (!text.trim() && mediaFiles.length === 0) || !canPost}>
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

