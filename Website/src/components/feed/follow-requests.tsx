"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Clock, Users, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type {
  FollowRequest as FollowRequestType,
  UserProfile,
} from "@/lib/types";

interface FollowRequestsProps {
  currentUserId: string;
  onRequestUpdate?: () => void;
}

// --- Updated Type ---
// Reflects the joined follower + their privacy settings
interface FollowRequest extends FollowRequestType {
  follower: UserProfile & {
    privacy_settings: {
      profile_visibility: "public" | "followers" | "private";
    } | null;
  };
}

export function FollowRequests({
  currentUserId,
  onRequestUpdate,
}: FollowRequestsProps) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFollowRequests();
  }, [currentUserId]);

  // --- Fetch follow requests ---
  const fetchFollowRequests = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("follow_requests")
        .select(`
          *,
          follower:follower_id (
            id,
            display_name,
            username,
            avatar_url,
            bio,
            privacy_settings:privacy_settings!user_id (
              profile_visibility
            )
          )
        `)
        .eq("following_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const validRequests = (data || []).filter((req) => req.follower);
      setRequests(validRequests as unknown as FollowRequest[]);
    } catch (error) {
      console.error("Error fetching follow requests:", error);
      toast({
        title: "Error",
        description: "Failed to load follow requests.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Accept or decline a single request ---
  const handleRequestAction = async (
    request: FollowRequest,
    action: "accept" | "decline"
  ) => {
    try {
      const supabase = createClient();

      if (action === "accept") {
        const { error } = await supabase.rpc("accept_follow_request", {
          request_follower_id: request.follower_id,
          request_following_id: request.following_id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follow_requests")
          .delete()
          .eq("id", request.id);
        if (error) throw error;
      }

      setRequests((prev) => prev.filter((req) => req.id !== request.id));

      toast({
        title:
          action === "accept" ? "Request accepted" : "Request declined",
        description:
          action === "accept"
            ? `You and ${request.follower.display_name} are now following each other.`
            : "Follow request has been declined.",
      });

      onRequestUpdate?.();
    } catch (error) {
      console.error(`Error ${action}ing follow request:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} follow request. Please try again.`,
        variant: "destructive",
      });
    }
  };

  // --- Accept all requests ---
  const handleAcceptAll = async () => {
    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("accept_all_follow_requests", {
        user_id: currentUserId,
      });

      if (error) throw error;

      setRequests([]);

      toast({
        title: "All requests accepted",
        description: "All pending follow requests have been accepted.",
      });

      onRequestUpdate?.();
    } catch (error) {
      console.error("Error accepting all requests:", error);
      toast({
        title: "Error",
        description: "Failed to accept all requests. Please try again.",
        variant: "destructive",
      });
    }
  };

  // --- Loading state ---
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Follow Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading requests...
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- No requests ---
  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Follow Requests
          </CardTitle>
          <CardDescription>
            People who want to follow you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending follow requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Main UI ---
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Follow Requests
            </CardTitle>
            <CardDescription>
              {requests.length} pending request
              {requests.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {requests.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleAcceptAll}>
              Accept All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => {
          const isFollowerPrivate =
            request.follower.privacy_settings?.profile_visibility ===
            "private";

          return (
            <div
              key={request.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={request.follower.avatar_url}
                    alt={request.follower.display_name}
                  />
                  <AvatarFallback>
                    {request.follower.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {request.follower.display_name}
                    </span>
                    {isFollowerPrivate && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDistanceToNow(
                        new Date(request.created_at),
                        { addSuffix: true }
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{request.follower.username}
                  </p>
                  {request.follower.bio && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {request.follower.bio}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleRequestAction(request, "accept")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRequestAction(request, "decline")}
                >
                  <UserX className="h-4 w-4 mr-1" />
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
