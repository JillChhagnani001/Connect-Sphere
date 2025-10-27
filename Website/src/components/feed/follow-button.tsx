"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserCheck, UserX, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Follow } from "@/lib/types";

interface FollowButtonProps {
  targetUserId: string;
  currentUserId?: string;
  isPrivate?: boolean;
  onFollowChange?: (isFollowing: boolean, status: string) => void;
}

export function FollowButton({ targetUserId, currentUserId, isPrivate = false, onFollowChange }: FollowButtonProps) {
  const [followStatus, setFollowStatus] = useState<{
    isFollowing: boolean;
    status: 'none' | 'pending' | 'accepted' | 'declined';
  }>({ isFollowing: false, status: 'none' });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUserId && currentUserId !== targetUserId) {
      checkFollowStatus();
    }
  }, [currentUserId, targetUserId]);

  const checkFollowStatus = async () => {
    if (!currentUserId) return;

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('follows')
        .select('status')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .single();

      if (data) {
        setFollowStatus({
          isFollowing: data.status === 'accepted',
          status: data.status
        });
      }
    } catch (error) {
      // No follow relationship found
      setFollowStatus({ isFollowing: false, status: 'none' });
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to follow users.",
        variant: "destructive",
      });
      return;
    }

    if (currentUserId === targetUserId) {
      toast({
        title: "Invalid action",
        description: "You cannot follow yourself.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      if (followStatus.isFollowing || followStatus.status === 'pending') {
        // Unfollow or cancel request
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);

        if (error) throw error;

        setFollowStatus({ isFollowing: false, status: 'none' });
        onFollowChange?.(false, 'none');

        toast({
          title: "Unfollowed",
          description: "You are no longer following this user.",
        });
      } else {
        // Follow or send request
        const status = isPrivate ? 'pending' : 'accepted';
        
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: targetUserId,
            status,
          });

        if (error) throw error;

        setFollowStatus({ isFollowing: status === 'accepted', status });
        onFollowChange?.(status === 'accepted', status);

        if (isPrivate) {
          toast({
            title: "Follow request sent",
            description: "Your follow request has been sent and is pending approval.",
          });
        } else {
          toast({
            title: "Following",
            description: "You are now following this user.",
          });
        }
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    if (followStatus.status === 'pending') {
      return (
        <>
          <Clock className="h-4 w-4 mr-2" />
          Pending
        </>
      );
    }

    if (followStatus.isFollowing) {
      return (
        <>
          <UserCheck className="h-4 w-4 mr-2" />
          Following
        </>
      );
    }

    return (
      <>
        <UserPlus className="h-4 w-4 mr-2" />
        Follow
      </>
    );
  };

  const getButtonVariant = () => {
    if (followStatus.status === 'pending') {
      return 'secondary';
    }
    if (followStatus.isFollowing) {
      return 'outline';
    }
    return 'default';
  };

  if (!currentUserId || currentUserId === targetUserId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={getButtonVariant()}
        onClick={handleFollow}
        disabled={isLoading}
        className="min-w-[100px]"
      >
        {isLoading ? "..." : getButtonContent()}
      </Button>
      
      {followStatus.status === 'pending' && (
        <Badge variant="outline" className="text-xs">
          Request sent
        </Badge>
      )}
    </div>
  );
}
