"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BadgeCheck, LogOut, Mail, Edit, Settings, Ban, Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProfileEditForm } from "./profile-edit-form";
import { FollowButton } from "../feed/follow-button";
import { useToast } from "@/hooks/use-toast";
import { ReportUserDialog } from "@/components/messages/report-user-dialog";
import type { ReportCategory, UserProfile } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FollowList } from "./follow-list";

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
  is_private: boolean; 
};

export function ProfileHeader({ 
  user: initialUser, 
  currentUserId,
  requiresFollowRequest,
  canViewFollowers,
  canViewFollowing,
  mutualFollowersCount = 0,
  isBanned = false,
}: Readonly<{ 
  user: Profile, 
  currentUserId: string | undefined,
  requiresFollowRequest: boolean,
  canViewFollowers: boolean,
  canViewFollowing: boolean,
  mutualFollowersCount?: number,
  isBanned?: boolean,
}>) {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers');
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isOwnProfile = currentUserId === user.id;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleMessage = async () => {
    if (!currentUserId || !user.id || currentUserId === user.id || isBanned) return;
    router.push(`/messages?userId=${user.id}`);
  };

  const handleSaveProfile = (updatedData: UserProfile) => {
    setUser(prevUser => ({ ...prevUser, ...updatedData }));
    setIsEditing(false);
    if (updatedData.username && updatedData.username !== initialUser.username) {
      router.push(`/profile/${updatedData.username}`);
      router.refresh();
    }
  };

  const handleCancelEdit = () => setIsEditing(false);

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

  const openFollowList = (type: 'followers' | 'following') => {
    if ((type === 'followers' && !canViewFollowers) || (type === 'following' && !canViewFollowing)) return;
    setFollowListType(type);
    setShowFollowModal(true);
  };

  const openReportDialog = () => {
    if (!currentUserId) {
      toast({ title: "Please log in", variant: "destructive" });
      return;
    }
    if (isOwnProfile) return;
    setIsReportDialogOpen(true);
  };

  const handleSubmitReport = async ({
    category,
    description,
    evidenceUrls,
  }: {
    category: ReportCategory;
    description: string;
    evidenceUrls: string[];
  }) => {
    if (!currentUserId) {
      throw new Error("You must be logged in to report users");
    }

    setIsSubmittingReport(true);
    let failureMessage: string | null = null;

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportedUserId: user.id,
          category,
          description,
          evidenceUrls,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        failureMessage =
          (payload && typeof payload === "object" && "error" in payload
            ? (payload as { error?: string }).error
            : undefined) ?? "Could not submit report";
        return;
      }

      toast({
        title: "Report submitted",
        description: "Thanks for flagging this. Our moderators will review it soon.",
      });
    } catch (error: any) {
      failureMessage = error?.message || "Could not submit report";
    } finally {
      setIsSubmittingReport(false);
    }

    if (failureMessage) {
      throw new Error(failureMessage);
    }
  };

  if (isEditing) {
    const userProfileForEdit: UserProfile = {
      id: user.id,
      display_name: user.display_name || '',
      username: user.username || '',
      avatar_url: user.avatar_url || '',
      bio: user.bio || '',
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      website: user.website ?? undefined,
      location: user.location ?? undefined,

      is_private: user.is_private ?? false,
      is_verified: user.isVerified ?? false,
      created_at: '',
      updated_at: '',
    };
    
    return <ProfileEditForm user={userProfileForEdit} onSave={handleSaveProfile} onCancel={handleCancelEdit} />;
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-8 items-start">
        {/* Avatar */}
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-primary shadow-lg">
            <AvatarImage src={user.avatar_url || undefined} alt={user.display_name || 'User avatar'} />
            <AvatarFallback>{(user.display_name || user.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>

        {/* Info */}
        <div className="flex-grow space-y-4 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              {user.username || 'username'}
              {user.isVerified && <BadgeCheck className="h-6 w-6 text-primary" />}
            </h1>

            {isOwnProfile ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" /> Edit Profile
                </Button>
                <Button variant="ghost" onClick={() => router.push('/settings')}>
                  <Settings className="h-4 w-4 mr-2" /> Settings
                </Button>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                {isBanned ? (
                  <>
                    <Button
                      variant="outline"
                      disabled
                      className="cursor-not-allowed"
                      title="You can't follow a suspended account"
                    >
                      <Ban className="h-4 w-4 mr-2" /> Suspended
                    </Button>
                    <Button
                      variant="secondary"
                      disabled
                      className="cursor-not-allowed"
                      title="You can't message a suspended account"
                    >
                      <Mail className="h-4 w-4 mr-2" /> Message
                    </Button>
                    <Button variant="outline" onClick={openReportDialog}>
                      <Flag className="h-4 w-4 mr-2" /> Report
                    </Button>
                  </>
                ) : (
                  <>
                    <FollowButton
                      targetUserId={user.id}
                      currentUserId={currentUserId}
                      isPrivate={requiresFollowRequest}
                      onFollowChange={refreshCounts}
                    />
                    <Button variant="secondary" onClick={handleMessage}>
                      <Mail className="h-4 w-4 mr-2"/> Message
                    </Button>
                    <Button variant="outline" onClick={openReportDialog}>
                      <Flag className="h-4 w-4 mr-2" /> Report
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Counts */}
          <div className="flex space-x-6 justify-center sm:justify-start text-sm">
            <div>
              <span className="font-bold">{user.postsCount}</span> posts
            </div>
            <div>
              {canViewFollowers ? (
                <button
                  type="button"
                  onClick={() => openFollowList('followers')}
                  className="font-bold text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded"
                >
                  {user.followersCount} followers
                </button>
              ) : (
                <span className="font-bold opacity-80">{user.followersCount} followers</span>
              )}
            </div>
            <div>
              {canViewFollowing ? (
                <button
                  type="button"
                  onClick={() => openFollowList('following')}
                  className="font-bold text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 rounded"
                >
                  {user.followingCount} following
                </button>
              ) : (
                <span className="font-bold opacity-80">{user.followingCount} following</span>
              )}
            </div>
          </div>

          {/* Bio and Mutual Followers */}
          <div className="text-center sm:text-left">
            <h2 className="font-semibold">{user.display_name || user.username}</h2>
            <p className="text-muted-foreground mt-2">{user.bio || 'No bio yet.'}</p>

            {/* Mutual Followers */}
            {!isOwnProfile && mutualFollowersCount > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                {mutualFollowersCount} mutual follower{mutualFollowersCount === 1 ? '' : 's'}
              </div>
            )}

            {(user.website || user.location) && (
              <div className="mt-2 space-y-1">
                {user.website && (
                  <p className="text-sm">
                    <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {user.website}
                    </a>
                  </p>
                )}
                {user.location && <p className="text-sm text-muted-foreground">{user.location}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Follow List Modal */}
      <Dialog open={showFollowModal} onOpenChange={setShowFollowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center">{followListType === 'followers' ? 'Followers' : 'Following'}</DialogTitle>
          </DialogHeader>
          <FollowList userId={user.id} currentUserId={currentUserId} type={followListType} />
        </DialogContent>
      </Dialog>

      {!isOwnProfile && (
        <ReportUserDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          onSubmit={handleSubmitReport}
          isSubmitting={isSubmittingReport}
          userDisplayName={user.display_name ?? user.username ?? null}
        />
      )}
    </>
  );
}