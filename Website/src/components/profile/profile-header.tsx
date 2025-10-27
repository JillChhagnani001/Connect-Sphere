"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BadgeCheck, UserPlus, LogOut, Mail, Edit, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileEditForm } from "./profile-edit-form";
import { FollowButton } from "../feed/follow-button";
import type { UserProfile } from "@/lib/types";

type Profile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  is_private?: boolean;
};

export function ProfileHeader({ user: profileUser, currentUserId }: { user: Profile, currentUserId: string | undefined }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(profileUser);
  
  const isOwnProfile = currentUserId === profileUser.id;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleSaveProfile = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <ProfileEditForm
        user={user as UserProfile}
        onSave={handleSaveProfile}
        onCancel={handleCancelEdit}
      />
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-8 items-start">
      <div className="flex-shrink-0 mx-auto sm:mx-0">
        <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-primary shadow-lg">
          <AvatarImage src={user.avatar_url} alt={user.display_name} data-ai-hint="user portrait" />
          <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-grow space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {user.username}
            {user.isVerified && <BadgeCheck className="h-6 w-6 text-primary" />}
            {user.is_private && (
              <span className="text-xs bg-muted px-2 py-1 rounded-full">Private</span>
            )}
          </h1>
          {isOwnProfile ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
              <Button variant="ghost" onClick={() => router.push('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <FollowButton
                targetUserId={user.id}
                currentUserId={currentUserId}
                isPrivate={user.is_private}
                onFollowChange={(isFollowing, status) => {
                  // Update follower count or other UI elements
                }}
              />
              <Button variant="secondary">
                <Mail className="h-4 w-4 mr-2"/>
                Message
              </Button>
            </div>
          )}
        </div>
        <div className="flex space-x-6 justify-center sm:justify-start">
          <div><span className="font-bold">{user.postsCount}</span> posts</div>
          <div><span className="font-bold">{user.followersCount}</span> followers</div>
          <div><span className="font-bold">{user.followingCount}</span> following</div>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="font-semibold">{user.display_name}</h2>
          <p className="text-muted-foreground">{user.bio}</p>
          {(user.website || user.location) && (
            <div className="mt-2 space-y-1">
              {user.website && (
                <p className="text-sm">
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {user.website}
                  </a>
                </p>
              )}
              {user.location && (
                <p className="text-sm text-muted-foreground">{user.location}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
