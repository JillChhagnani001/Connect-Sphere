"use client";

import { useToast } from "@/hooks/use-toast";

export function CreatePost() {
  const { toast } = useToast();

  const handlePost = () => {
    toast({
      title: "Post Created!",
      description: "Your post has been added to the feed (mocked).",
    });
  };

  return null;
}
