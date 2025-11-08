"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { CommentsSection } from '@/components/feed/comments-section'; 
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

// Define a minimal Post structure for this page
interface FullPost {
    id: number;
    text: string;
    media: { url: string; type: string }[];
    author: { display_name: string; avatar_url: string; username: string };
    created_at: string;
    user_id: string; // Needed for comments component
}

export default function PostDetail() {
    const params = useParams();
    // Ensure params.id is treated as a string before converting to number
    const postId = params.id ? parseInt(params.id as string) : null;
    const [post, setPost] = useState<FullPost | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);


    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id);
        });

        if (postId) {
            fetchPost();
        }
    }, [postId]);

    const fetchPost = async () => {
        const supabase = createClient();
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`
                    id, text, media, created_at, user_id,
                    author:profiles(display_name, avatar_url, username)
                `)
                .eq('id', postId)
                .single();

            if (error || !data) {
                console.error("Error fetching post:", error);
                setPost(null);
            } else {
                setPost(data as FullPost);
            }
        } catch (e) {
            console.error("Fetch failed:", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <AppShell><div className="text-center py-16">Loading post...</div></AppShell>;
    }

    if (!post) {
        return <AppShell><div className="text-center py-16 text-destructive">Post not found or access denied.</div></AppShell>;
    }

    return (
        <AppShell>
            <div className="max-w-2xl mx-auto space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center space-x-3 p-4">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={post.author?.avatar_url} alt={post.author?.display_name} />
                            <AvatarFallback>{post.author?.display_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-lg">{post.author?.display_name}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                @{post.author?.username}
                            </p>
                        </div>
                        <span className="ml-auto text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {post.text && <p>{post.text}</p>}
                        {post.media?.[0]?.url && (
                            <div className="relative aspect-square rounded-lg overflow-hidden w-full">
                                <Image
                                    src={post.media[0].url}
                                    alt={post.text || "Post image"}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Comments Section */}
                <CommentsSection postId={post.id} currentUserId={currentUserId} />
            </div>
        </AppShell>
    );
}