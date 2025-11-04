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
  profileVisibility?: "public" | "followers" | "private"; // <- updated
  onFollowChange?: (isFollowing: boolean, status: string) => void;
}

export function FollowButton({
  targetUserId,
  currentUserId,
  profileVisibility = "public",
  onFollowChange,
}: FollowButtonProps) {
  const [followState, setFollowState] = useState<
    "none" | "following" | "requested"
  >("none");
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

      // Check if already following
      const { data: followData } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId)
        .single();

      if (followData) {
        setFollowState("following");
        return;
      }

      // Check if there is a pending request
      const { data: requestData } = await supabase
        .from("follow_requests")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId)
        .single();

      if (requestData) {
        setFollowState("requested");
      } else {
        setFollowState("none");
      }
    } catch (error) {
      setFollowState("none");
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

    if (currentUserId === targetUserId) return;

    setIsLoading(true);
    const supabase = createClient();

    try {
      // Already following -> Unfollow
      if (followState === "following") {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", targetUserId);

        if (error) throw error;

        setFollowState("none");
        setTimeout(() => onFollowChange?.(false, "none"), 400);
        toast({ title: "Unfollowed" });

      // Pending request -> Cancel request
      } else if (followState === "requested") {
        const { error } = await supabase
          .from("follow_requests")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", targetUserId);

        if (error) throw error;

        setFollowState("none");
        setTimeout(() => onFollowChange?.(false, "none"), 400);
        toast({ title: "Follow request cancelled" });

      // Not following -> Follow or send request
      } else if (followState === "none") {
        if (profileVisibility === "private" || profileVisibility === "followers") {
          // Send follow request
          const { error } = await supabase
            .from("follow_requests")
            .insert({
              follower_id: currentUserId,
              following_id: targetUserId,
            });

          if (error) throw error;

          setFollowState("requested");
          setTimeout(() => onFollowChange?.(false, "requested"), 400);
          toast({
            title: "Follow request sent",
            description: "Your request is pending approval.",
          });
        } else {
          // Follow directly
          const { error } = await supabase
            .from("followers")
            .insert({
              follower_id: currentUserId,
              following_id: targetUserId,
            });

          if (error) throw error;

          setFollowState("following");
          setTimeout(() => onFollowChange?.(true, "following"), 400);
          toast({
            title: "Following",
            description: "You are now following this user.",
          });
        }
      }
    } catch (error: any) {
      console.error("Error updating follow status:", error);
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
    if (followState === "requested") {
      return (
        <>
          <Clock className="h-4 w-4 mr-2" />
          Pending
        </>
      );
    }

    if (followState === "following") {
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
    if (followState === "requested") return "secondary";
    if (followState === "following") return "outline";
    return "default";
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

      {followState === "requested" && (
        <Badge variant="outline" className="text-xs">
          Request sent
        </Badge>
      )}
    </div>
  );
}
