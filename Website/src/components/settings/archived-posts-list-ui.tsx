"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client"; 
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCcw } from "lucide-react";
import Image from "next/image";
interface Post {
  id: number;
  text: string | null;
  media: any[] | null;
  created_at: string;
  is_archived: boolean;
}

export function ArchivedPostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  useEffect(() => {
    const loadPosts = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_archived", true)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error("Failed to load archived posts", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, [supabase]);
  const handleUnarchive = async (postId: number) => {
    setActionLoading(postId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("posts")
        .update({ is_archived: false })
        .eq("id", postId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Success", description: "Post restored to your profile." });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      router.refresh();

    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to unarchive post", 
        variant: "destructive" 
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (posts.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
        You have no archived posts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="flex items-start gap-4 p-4 border rounded-lg bg-card/50">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted border">
            {post.media && post.media.length > 0 ? (
              <Image 
                src={typeof post.media[0] === 'string' ? post.media[0] : post.media[0].url} 
                alt="Post thumbnail" 
                fill 
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No Image
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[5rem]">
            <div>
              <p className="text-sm font-medium line-clamp-2 mb-1">
                {post.text || "Untitled Post"}
              </p>
              <p className="text-xs text-muted-foreground">
                Posted {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
            
            <div className="mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8"
                onClick={() => handleUnarchive(post.id)}
                disabled={actionLoading === post.id}
              >
                {actionLoading === post.id ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                ) : (
                  <RefreshCcw className="h-3 w-3 mr-2" />
                )}
                Unarchive
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}