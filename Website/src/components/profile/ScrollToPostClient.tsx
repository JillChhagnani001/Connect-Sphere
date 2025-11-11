"use client";

import { useEffect } from 'react';

interface ScrollToPostClientProps {
    targetId: string;
}

/**
 * Client component to scroll the viewport to a specific post ID
 * passed in the URL query parameter (e.g., ?postId=123).
 */
export function ScrollToPostClient({ targetId }: ScrollToPostClientProps) {
    useEffect(() => {
        if (targetId) {
            // Prepend 'post-' to match the ID set in the server component (page.tsx)
            const elementId = `post-${targetId}`;
            const element = document.getElementById(elementId);

            if (element) {
                // Scroll the element into view with smooth behavior
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [targetId]);

    // This component renders nothing, its only job is to execute the useEffect hook
    return null;
}