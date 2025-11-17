"use client";

import { useRouter } from 'next/navigation';
import React from 'react';
import { Post } from '@/lib/types'; 

interface PostClickHandlerProps {
    post: Partial<Post>;
    children: React.ReactNode;
    context?: 'posts' | 'threads' | 'saved' | 'tagged'; 
}

/**
 * Client Component that wraps a clickable post thumbnail or thread item.
 * It uses the Next.js router to navigate to the full post view.
 */
export function PostClickHandler({ post, children, context }: PostClickHandlerProps) {
    // 1. Get access to the Next.js router (only works in Client Components)
    const router = useRouter();

  const handlePostClick = () => {
        if (post.id && post.author?.username) {
            let route: string;
            
            if (context === 'saved' || context === 'tagged') {
                // If the context is 'saved', navigate to a dedicated saved route, 
                route = `/post/${post.id}`;
            } else {
                // Default action for 'posts' and 'threads' tabs
                // Navigates to the user's full post archive
                route = `/profile/${post.author.username}/posts?postId=${post.id}`;
            }
            
            router.push(route, { scroll: false });
        } else {
            console.error("Attempted to click a post without an ID or author username.");
        }
    };
    // 3. Render the wrapper element with click functionality
    // Styles are adapted for both grid (image) and list (thread) display modes.
    return (
        <div 
            key={post.id}
            // Apply cursor and transition styles universally
            className="cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={handlePostClick}
            
            // Apply layout styles based on whether the post has media (for grid layout)
            style={(post.media && post.media.length > 0) 
                ? { position: 'relative', aspectRatio: '1/1' } // Styles for grid items
                : {} // Default styles for thread items
            }
        >
            {children}
        </div>
    );
}