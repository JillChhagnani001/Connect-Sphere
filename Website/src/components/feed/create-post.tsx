"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Image, Video, FileText, MapPin, Smile } from "lucide-react";
import { CreatePostModal } from "./create-post-modal";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";

export function CreatePost() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'post' | 'thread'>('post');
  const router = useRouter();
  const { profile } = useUser();

  const handlePostCreated = () => {
    console.log('Post created, refreshing page...');
    router.refresh();
  };

  const handleOpenModal = (tab: 'post' | 'thread') => {
    setInitialTab(tab);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-card rounded-2xl p-4 shadow-sm border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.display_name || profile?.username || "User"} />
            <AvatarFallback>
              {(profile?.display_name || profile?.username || "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="outline"
            className="flex-1 justify-start text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenModal('post')}
          >
            Create a new post...
          </Button>
        </div>
        
        <div className="flex items-center justify-around mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenModal('post')}
            className="flex-1"
          >
            <Image className="h-4 w-4 mr-2" />
            Photo/Video
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenModal('thread')}
            className="flex-1"
          >
            <FileText className="h-4 w-4 mr-2" />
            Thread
          </Button>
        </div>
      </div>

      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPostCreated={handlePostCreated}
        initialTab={initialTab}
      />
    </>
  );
}
