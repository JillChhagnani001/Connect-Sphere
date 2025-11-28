"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import {
  Grid3x3,
  Bookmark,
  UserSquare2,
  FileText,
  Heart,
  MessageSquare,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import type { Post } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PostClickHandler } from "@/components/profile/PostClickHandler";
import { SavedPostsTab } from "./saved-posts-tab";

const GRID_CLASS = "grid grid-cols-3 md:grid-cols-3 gap-1 md:gap-4";

type ProfileContentTabsProps = {
  posts: ReadonlyArray<Partial<Post>>;
  threads: ReadonlyArray<Partial<Post>>;
  taggedPosts: Partial<Post>[];
  username: string;
  isOwner: boolean;
  profileId: string;
  hasMorePosts: boolean;
  hasMoreTagged: boolean;
  savedPageSize: number;
};

export function ProfileContentTabs({
  posts,
  threads,
  taggedPosts,
  username,
  isOwner,
  profileId,
  hasMorePosts,
  hasMoreTagged,
  savedPageSize,
}: Readonly<ProfileContentTabsProps>) {
  const [currentTab, setCurrentTab] = useState("posts");

  return (
    <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="posts">
          <Grid3x3 className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Posts</span>
        </TabsTrigger>
        <TabsTrigger value="threads">
          <FileText className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Threads</span>
        </TabsTrigger>
        <TabsTrigger value="saved">
          <Bookmark className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Saved</span>
        </TabsTrigger>
        <TabsTrigger value="tagged">
          <UserSquare2 className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Tagged</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="mt-6">
        <div className={GRID_CLASS}>
          {posts.length > 0 ? (
            posts.map((post) => (
              <PostClickHandler key={post.id} post={post}>
                {post.media?.[0]?.url ? (
                  <Image
                    src={post.media[0].url}
                    alt={post.text || "Post image"}
                    fill
                    className="object-cover rounded-md md:rounded-lg"
                  />
                ) : (
                  <div className="bg-muted h-full w-full rounded-md md:rounded-lg" />
                )}
              </PostClickHandler>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-16 col-span-3">
              <Grid3x3 className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">No Posts Yet</h3>
              <p>This user hasn&apos;t shared any posts.</p>
            </div>
          )}
        </div>
        {hasMorePosts && (
          <div className="flex justify-center mt-6">
            <Button asChild variant="outline">
              <a href={`/profile/${username}/posts`}>View all posts</a>
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="threads" className="mt-6">
        {threads.length > 0 ? (
          <div className="space-y-6 max-w-2xl">
            {threads.map((thread) => (
              <PostClickHandler key={thread.id} post={thread}>
                <div className="flex gap-4 border-b pb-6">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={thread.author?.avatar_url || ""} alt={thread.author?.display_name || thread.author?.username || username} />
                    <AvatarFallback>
                      {(thread.author?.display_name || thread.author?.username || username).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{thread.author?.username}</p>
                        {thread.created_at && (
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm">{thread.text}</p>
                    <div className="flex items-center gap-4 text-muted-foreground text-sm pt-2">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        <span>{thread.like_count ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{thread.comment_count ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Share2 className="h-4 w-4" />
                        <span>{thread.share_count ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bookmark className="h-4 w-4" />
                        <span>{thread.save_count ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </PostClickHandler>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16 col-span-3">
            <FileText className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-xl font-semibold">No Threads Yet</h3>
            <p>This user hasn&apos;t posted any threads.</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="saved" className="mt-6">
        <SavedPostsTab
          profileId={profileId}
          isOwner={isOwner}
          isActive={currentTab === "saved"}
          pageSize={savedPageSize}
        />
      </TabsContent>

      <TabsContent value="tagged" className="mt-6">
        <div className={GRID_CLASS}>
          {taggedPosts.length > 0 ? (
            taggedPosts.map((post) => (
              <PostClickHandler key={`tagged-${post.id}`} post={post} context="tagged">
                {post.media?.[0]?.url ? (
                  <Image
                    src={post.media[0].url}
                    alt={post.text || "Tagged post image"}
                    fill
                    className="object-cover rounded-md md:rounded-lg"
                  />
                ) : (
                  <div className="bg-muted h-full w-full rounded-md md:rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground p-2">
                      {post.text}
                    </span>
                  </div>
                )}
              </PostClickHandler>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-16 col-span-3">
              <UserSquare2 className="h-12 w-12 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">No Tagged Posts</h3>
              <p>Posts this user is tagged in will appear here.</p>
            </div>
          )}
        </div>
        {/* TODO: Add your infinite scroll loader here based on hasMoreTagged */}
      </TabsContent>
    </Tabs>
  );
}
