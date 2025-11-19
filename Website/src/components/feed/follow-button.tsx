"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserCheck, UserX, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowButtonProps {
  targetUserId: string;
  currentUserId?: string;
  isPrivate?: boolean;
  onFollowChange?: (isFollowing: boolean, status: string) => void;
}

export function FollowButton({ targetUserId, currentUserId, isPrivate = false, onFollowChange }: FollowButtonProps) {
  const [followStatus, setFollowStatus] = useState<{
    isFollowing: boolean;
    status: 'none' | 'pending' | 'accepted';
  }>({ isFollowing: false, status: 'none' });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUserId && currentUserId !== targetUserId) {
      checkFollowStatus();
    } else if (currentUserId !== targetUserId) {
      setIsLoading(false);
    }
  }, [currentUserId, targetUserId]);

  const checkFollowStatus = async () => {
    if (!currentUserId) return;

    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // 1. Check 'followers' table
      const { data: followData } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (followData) {
        setFollowStatus({ isFollowing: true, status: 'accepted' });
      } else {
        // 2. Check 'follow_requests' table
        const { data: requestData } = await supabase
          .from('follow_requests')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId)
          .maybeSingle();
        
        if (requestData) {
          setFollowStatus({ isFollowing: false, status: 'pending' });
        } else {
          setFollowStatus({ isFollowing: false, status: 'none' });
        }
      }
    } catch (error) {
      setFollowStatus({ isFollowing: false, status: 'none' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) {
      toast({ title: "Please log in", variant: "destructive" });
      return;
    }
    if (currentUserId === targetUserId) {
      toast({ title: "You cannot follow yourself.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      if (followStatus.status === 'accepted') {
        // --- UNFOLLOW ---
        // Delete from 'followers' table
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
        setFollowStatus({ isFollowing: false, status: 'none' });
        setTimeout(() => onFollowChange?.(false, 'none'), 400);
        toast({ title: "Unfollowed" });

      } else if (followStatus.status === 'pending') {
        // --- CANCEL FOLLOW REQUEST ---
        // Delete from 'follow_requests' table
        const { error } = await supabase
          .from('follow_requests')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
        setFollowStatus({ isFollowing: false, status: 'none' });
        setTimeout(() => onFollowChange?.(false, 'none'), 400);
        toast({ title: "Request Canceled" });

      } else if (followStatus.status === 'none') {
        // --- SEND FOLLOW OR REQUEST ---
        if (isPrivate) {
          // --- SEND REQUEST to 'follow_requests' ---
          // First check if request already exists
          const { data: existingRequest } = await supabase
            .from('follow_requests')
            .select('*')
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId)
            .maybeSingle();
          
          if (existingRequest) {
            toast({ title: "Follow request already sent", variant: "destructive" });
            return;
          }

          const { error } = await supabase
            .from('follow_requests')
            .insert({
              follower_id: currentUserId,
              following_id: targetUserId,
            });
          if (error) throw error;
          setFollowStatus({ isFollowing: false, status: 'pending' });
          setTimeout(() => onFollowChange?.(false, 'pending'), 400);
          toast({ title: "Follow request sent" });
        } else {
          // --- FOLLOW DIRECTLY to 'followers' ---
          const { error } = await supabase
            .from('followers')
            .insert({
              follower_id: currentUserId,
              following_id: targetUserId,
            });
          if (error) throw error;
          setFollowStatus({ isFollowing: true, status: 'accepted' });
          setTimeout(() => onFollowChange?.(true, 'accepted'), 400);
          toast({ title: "Following" });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    if (followStatus.status === 'pending') {
      return ( <> <Clock className="h-4 w-4 mr-2" /> Pending </> );
    }
    if (followStatus.isFollowing) {
      return ( <> <UserCheck className="h-4 w-4 mr-2" /> Following </> );
    }
    return ( <> <UserPlus className="h-4 w-4 mr-2" /> Follow </> );
  };

  const getButtonVariant = () => {
    if (followStatus.status === 'pending') return 'secondary';
    if (followStatus.isFollowing) return 'outline';
    return 'default';
  };

  if (!currentUserId || currentUserId === targetUserId) return null;

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