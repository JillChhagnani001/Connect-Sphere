"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BadgeCheck, UserPlus, LogOut, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
};

export function ProfileHeader({ user: profileUser, currentUserId }: { user: Profile, currentUserId: string | undefined }) {
  const router = useRouter();
  
  const isFollowing = false; // Mock state
  const isOwnProfile = currentUserId === profileUser.id;

  const handleFollow = () => {
    // Mock action
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-8 items-start">
      <div className="flex-shrink-0 mx-auto sm:mx-0">
        <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-primary shadow-lg">
          <AvatarImage src={profileUser.avatar_url} alt={profileUser.display_name} data-ai-hint="user portrait" />
          <AvatarFallback>{profileUser.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-grow space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {profileUser.username}
            {profileUser.isVerified && <BadgeCheck className="h-6 w-6 text-primary" />}
          </h1>
          {isOwnProfile ? (
            <div className="flex gap-2">
             <Button variant="outline">Edit Profile</Button>
             <Button variant="ghost" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" /> Logout</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleFollow}><UserPlus className="h-4 w-4 mr-2" /> {isFollowing ? 'Unfollow' : 'Follow'}</Button>
              <Button variant="secondary"><Mail className="h-4 w-4 mr-2"/>Message</Button>
            </div>
          )}
        </div>
        <div className="flex space-x-6 justify-center sm:justify-start">
          <div><span className="font-bold">{profileUser.postsCount}</span> posts</div>
          <div><span className="font-bold">{profileUser.followersCount}</span> followers</div>
          <div><span className="font-bold">{profileUser.followingCount}</span> following</div>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="font-semibold">{profileUser.display_name}</h2>
          <p className="text-muted-foreground">{profileUser.bio}</p>
        </div>
      </div>
    </div>
  );
}
