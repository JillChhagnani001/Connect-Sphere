"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BadgeCheck, LogOut, Mail, Edit, Settings, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileEditForm } from "./profile-edit-form";
import { FollowButton } from "../feed/follow-button";
import type { UserProfile } from "@/lib/types";

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  location?: string | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isVerified: boolean;
  is_private: boolean; // This will now control the Lock Icon
};

// ✨ --- PROPS CHANGED --- ✨
// We now accept 'requiresFollowRequest' to control the button
export function ProfileHeader({ 
  user: initialUser, 
  currentUserId,
  requiresFollowRequest // This new prop controls the follow button
}: { 
  user: Profile, 
  currentUserId: string | undefined,
  requiresFollowRequest: boolean
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(initialUser);
  
  const isOwnProfile = currentUserId === user.id;

  const handleLogout = async () => {
    
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleSaveProfile = (updatedData: UserProfile) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedData
    }));
    setIsEditing(false);
    if (updatedData.username && updatedData.username !== initialUser.username) {
        router.push(`/profile/${updatedData.username}`);
        router.refresh();
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };
  
  const refreshCounts = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("follower_count, following_count")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      setUser((prev) => ({
        ...prev,
        followersCount: data.follower_count ?? prev.followersCount,
        followingCount: data.following_count ?? prev.followingCount,
      }));
    }
  };

  if (isEditing) {
    const userProfileForEdit: UserProfile = {
      id: user.id,
      display_name: user.display_name || '',
      username: user.username || '',
      avatar_url: user.avatar_url || '',
      bio: user.bio || '',
      email: user.email,
      phone: user.phone,
      website: user.website,
      location: user.location,
      is_private: user.is_private ?? false,
      is_verified: user.isVerified ?? false,
      created_at: '',
      updated_at: '',
    };
    
    return (
      <ProfileEditForm
        user={userProfileForEdit}
        onSave={handleSaveProfile}
        onCancel={handleCancelEdit}
      />
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-8 items-start">
      <div className="flex-shrink-0 mx-auto sm:mx-0">
        <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-primary shadow-lg">
          <AvatarImage src={user.avatar_url || undefined} alt={user.display_name || 'User avatar'} data-ai-hint="user portrait" />
          <AvatarFallback>{(user.display_name || user.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-grow space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {user.username || 'username'}
            {user.isVerified && <BadgeCheck className="h-6 w-6 text-primary" />}
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
                // ✨ --- THIS IS THE FIX --- ✨
                // The button's privacy is controlled by the *new* prop
                isPrivate={requiresFollowRequest}
                onFollowChange={async (isFollowing, status) => {
                  await refreshCounts();
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
          <h2 className="font-semibold">{user.display_name || user.username}</h2>
          
          {/* ✨ --- THIS IS THE FIX --- ✨ */}
          {/* The Lock Icon's visibility is controlled by user.is_private */}
          {user.is_private && isOwnProfile && (
             <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                <Lock className="h-3 w-3"/> This account is private
             </div>
          )}
          
          <p className="text-muted-foreground mt-2">{user.bio || 'No bio yet.'}</p>
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

