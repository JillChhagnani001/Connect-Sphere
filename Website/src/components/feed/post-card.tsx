"use client"
import Image from "next/image";
import Link from "next/link";
import { MoreHorizontal, MessageSquare, ThumbsUp, Share2, Bookmark } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import type { Post } from "@/lib/types";
import { Input } from "../ui/input";
import placeholderData from "@/lib/placeholder-data";

export function PostCard({ post }: { post: Post }) {
  const [timeAgo, setTimeAgo] = useState('');
  const profile = placeholderData.users[0];

  useEffect(() => {
    if (post.created_at) {
      // Set the time ago string once on the client after hydration
      setTimeAgo(formatDistanceToNow(new Date(post.created_at), { addSuffix: true }));
    }
  }, [post.created_at]);


  return (
    <Card className="w-full rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 p-4">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatar_url} alt={post.author.display_name} data-ai-hint="user avatar" />
            <AvatarFallback>{post.author.display_name?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 flex items-center">
            <div className="flex flex-col">
                <Link href={`/profile/${post.author.username}`} className="font-semibold hover:underline text-sm">
                    {post.author.display_name}
                </Link>
                <span className="text-xs text-muted-foreground">
                    {timeAgo}
                </span>
            </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        {post.text && <p className="mb-4 text-sm">{post.text.split('#').map((part, i) => i === 0 ? part : <Link href="#" key={i} className="text-primary hover:underline">#{part.split(' ')[0]}</Link>).reduce((prev, curr, i) => [prev, i > 1 ? " " : "", curr] as any)}</p>}
        {post.media && post.media.length > 0 && (
            <div className="relative w-full aspect-auto overflow-hidden rounded-lg border">
                 <Image 
                  src={post.media[0].url} 
                  alt={post.text || 'Post image'}
                  width={post.media[0].width || 800}
                  height={post.media[0].height || 600}
                  className="object-cover w-full h-auto"
                  data-ai-hint="social media post" />
            </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start p-4 gap-4">
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
            <div className="flex gap-1 sm:gap-4">
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5 px-2">
                    <ThumbsUp className="h-4 w-4"/> <span className="hidden sm:inline">12 Likes</span>
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5 px-2">
                    <MessageSquare className="h-4 w-4"/> <span className="hidden sm:inline">25 Comments</span>
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5 px-2">
                    <Share2 className="h-4 w-4"/> <span className="hidden sm:inline">187 Share</span>
                </Button>
            </div>
            <Button variant="ghost" size="sm" className="flex items-center gap-1.5 px-2">
                <Bookmark className="h-4 w-4"/> <span className="hidden sm:inline">8 Saved</span>
            </Button>
        </div>
        <div className="w-full flex items-center gap-3">
             <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url} alt="User Avatar" data-ai-hint="user avatar" />
                <AvatarFallback>{profile?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="relative flex-1">
                <Input placeholder="Write your comment..." className="bg-muted border-none rounded-full pr-20" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                    </Button>
                     <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
                    </Button>
                </div>
            </div>
        </div>
      </CardFooter>
    </Card>
  );
}
