// @ts-nocheck
"use client"

import Image from "next/image";
import Link from "next/link";
import { MoreHorizontal, MessageSquare, Users , RefreshCcw} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import type { Post } from "@/lib/types";
import { Input } from "../ui/input";
import { EngagementActions } from "./engagement-actions";
import { CommentsSection } from "@/components/feed/comments-section";
import placeholderData from "@/lib/placeholder-data";
import { createClient } from "@/lib/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { Archive, Trash2, UserX, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export function PostCard({ post }: { post: Post }) {
  const [timeAgo, setTimeAgo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showComments, setShowComments] = useState(false);
  const [collabProfiles, setCollabProfiles] = useState<any[]>([]);
  const profile = placeholderData.users[0];
  const [isProcessing, setIsProcessing] = useState(false);
  const [isArchived, setIsArchived] = useState(post.is_archived || false);
  const [isDeleted, setIsDeleted] = useState(false);  
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (post.created_at) {
      try {
        setTimeAgo(formatDistanceToNow(new Date(post.created_at), { addSuffix: true }));
      } catch (e) {
        setTimeAgo('recently');
      }
    }
  }, [post.created_at]);

  useEffect(() => {
    //const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));

    const fetchCollabs = async () => {
      if (!Array.isArray(post.collaborators)) {
        setCollabProfiles([]);
        return;
      }

      // Only show collaborators who have ACCEPTED
      const accepted = post.collaborators.filter((c: any) => c && c.accepted);
      if (accepted.length === 0) {
        setCollabProfiles([]);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', accepted.map((c: any) => c.user_id));

      setCollabProfiles(data?.filter(Boolean) || []);
    };
    fetchCollabs();
  }, [post.collaborators]);

  // Helper to safely get initials
  const getInitials = (name?: string | null) => {
    return (name || '?').charAt(0).toUpperCase();
  };

  const isOwner = currentUserId === post.user_id;
  const isCollaborator =!isOwner&&Array.isArray(post.collaborators) && post.collaborators.some(
    (c: any) => c.user_id === currentUserId && c.accepted
  );

  const handleArchive = async () => {
    if(isProcessing) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_archived: true })
        .eq("id", post.id)
        .eq("user_id", post.user_id);

        if (error) throw error;
      setIsArchived(true);
      toast({ title: "Post archived", description: "You can restore it from Archived Posts in settings." });
      router.refresh();
    }
    catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to archive post", 
        variant: "destructive" 
      });
    }
    finally {
      setIsProcessing(false);
    }
  };

  const handleUnarchive = async () => {
    if(isProcessing) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_archived: false })
        .eq("id", post.id)
        .eq("user_id", post.user_id);
      if (error) throw error;
      setIsArchived(false);
      toast({ title: "Unarchived", description: "Post restored to your profile." });
      router.refresh();
    }
    catch (error: any) {
      toast({ 
        title: "Error",
        description: error.message || "Failed to unarchive post",
        variant: "destructive"
      });
    }
    finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if(isProcessing) return;
    if(!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", post.user_id);
      if (error) throw error;
      setIsDeleted(true);
      toast({ title: "Post deleted", description: "Your post has been permanently deleted." });
      router.refresh();
    }
    catch (error: any) {
      toast({ 
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive"
      });
    }
    finally {
      setIsProcessing(false);
    }
  }

  if(isDeleted) return null; // Don't render if deleted

  return (
    <Card className="w-full rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 p-4">
        <Link href={`/profile/${post.author?.username}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.avatar_url} alt={post.author?.display_name} />
            <AvatarFallback>{getInitials(post.author?.display_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 flex items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <Link href={`/profile/${post.author?.username}`} className="font-semibold hover:underline text-sm">
                {post.author?.display_name || 'Unknown User'}
              </Link>
              
              {/* Collaborators Icon & Popover */}
              {collabProfiles.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary ml-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="sr-only">View collaborators</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2" align="start">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2">In collaboration with</h4>
                    <div className="space-y-1">
                      {collabProfiles.map(p => (
                        <Link key={p.id} href={`/profile/${p.username}`} className="flex items-center gap-2 hover:bg-muted p-2 rounded-md transition-colors">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={p.avatar_url} />
                            <AvatarFallback>{getInitials(p.display_name || p.username)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium leading-none truncate">{p.display_name || p.username}</span>
                            {p.username && <span className="text-xs text-muted-foreground truncate">@{p.username}</span>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{timeAgo}</div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && (
              <>
              {isArchived ? (
                <DropdownMenuItem onClick={handleUnarchive} className="cursor-pointer">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  <span>Unarchive</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleArchive} className="cursor-pointer">
                  <Archive className="mr-2 h-4 w-4" />
                  <span>Archive</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Post</span>
              </DropdownMenuItem>
              </>
            )}  
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        {post.text && <p className="mb-4 text-sm">{post.text}</p>}
        {post.media?.[0] && (
          <div className="relative w-full aspect-auto rounded-lg border overflow-hidden">
            {post.media[0].mime_type?.startsWith('video') ? (
              <video src={post.media[0].url} controls className="w-full h-auto max-h-[600px] bg-black" />
            ) : (
              <Image
                src={post.media[0].url}
                alt="Post media"
                width={post.media[0].width || 800}
                height={post.media[0].height || 600}
                className="object-cover w-full h-auto max-h-[600px]"
              />
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start p-4 gap-4">
        <EngagementActions post={post} currentUserId={currentUserId} onCommentClick={() => setShowComments(prev => !prev)} />
        {showComments && <CommentsSection postId={post.id} currentUserId={currentUserId} />}
      </CardFooter>
    </Card>
  );
}