"use client"

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SearchUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface SearchPost {
  id: number;
  text: string;
  user_id: string;
  author: SearchUser;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Search users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(5);

      if (!usersError && usersData) {
        setUsers(usersData as SearchUser[]);
      }

      // Search posts
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("id, text, user_id, author:profiles(id, username, display_name, avatar_url)")
        .ilike("text", `%${searchQuery}%`)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!postsError && postsData) {
        setPosts(postsData as SearchPost[]);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setUsers([]);
      setPosts([]);
      setIsOpen(false);
      return;
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsLoading(true);
    setIsOpen(true);

    searchTimeoutRef.current = setTimeout(async () => {
      await performSearch(query.trim());
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  const handleUserClick = (username: string | null, userId?: string) => {
    setQuery("");
    setIsOpen(false);
    if (username && username !== 'null' && username !== '') {
      router.push(`/profile/${username}`);
    } else if (userId) {
      router.push(`/profile/${userId}`);
    }
  };

  const handlePostClick = (postId: number, username: string | null, userId?: string) => {
    setQuery("");
    setIsOpen(false);
    if (username && username !== 'null' && username !== '') {
      router.push(`/profile/${username}/posts?postId=${postId}`);
    } else if (userId) {
      router.push(`/profile/${userId}/posts?postId=${postId}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter" && query.trim().length >= 2) {
      // Navigate to search results page or first result
      if (users.length > 0) {
        handleUserClick(users[0].username, users[0].id);
      } else if (posts.length > 0) {
        const post = posts[0];
        handlePostClick(post.id, post.author.username, post.user_id);
      }
    }
  };

  const hasResults = users.length > 0 || posts.length > 0;
  const showResults = isOpen && query.trim().length >= 2 && (hasResults || isLoading);

  return (
    <Popover open={showResults} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="w-full max-w-md relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              className="w-full bg-card pl-10 rounded-full"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query.trim().length >= 2) {
                  setIsOpen(true);
                }
              }}
            />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={8}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasResults ? (
          <div className="max-h-[400px] overflow-y-auto">
            {users.length > 0 && (
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Users
                </div>
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user.username, user.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {user.display_name?.charAt(0) || user.username?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {user.display_name || user.username || "User"}
                      </div>
                      {user.username && (
                        <div className="text-sm text-muted-foreground truncate">
                          @{user.username}
                        </div>
                      )}
                    </div>
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {posts.length > 0 && (
              <div className="p-2 border-t">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Posts
                </div>
                {posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() =>
                      handlePostClick(post.id, post.author.username, post.user_id)
                    }
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0">
                      <AvatarImage src={post.author.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {post.author.display_name?.charAt(0) ||
                          post.author.username?.charAt(0) ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {post.author.display_name || post.author.username || "User"}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {post.text}
                      </div>
                    </div>
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : query.trim().length >= 2 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No results found
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

