"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Clock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Follow, UserProfile } from "@/lib/types";

interface FollowRequestsProps {
  currentUserId: string;
  onRequestUpdate?: () => void;
}

interface FollowRequest extends Follow {
  follower: UserProfile;
}

export function FollowRequests({ currentUserId, onRequestUpdate }: FollowRequestsProps) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFollowRequests();
  }, [currentUserId]);

  const fetchFollowRequests = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('follows')
        .select(`
          *,
          follower:profiles(*)
        `)
        .eq('following_id', currentUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data as FollowRequest[] || []);
    } catch (error) {
      console.error('Error fetching follow requests:', error);
      toast({
        title: "Error",
        description: "Failed to load follow requests.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAction = async (requestId: number, action: 'accept' | 'decline') => {
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('follows')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', requestId);

      if (error) throw error;

      // Remove from local state
      setRequests(prev => prev.filter(req => req.id !== requestId));

      toast({
        title: action === 'accept' ? "Request accepted" : "Request declined",
        description: action === 'accept' 
          ? "You are now following this user." 
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

  const handleAcceptAll = async () => {
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('follows')
        .update({ status: 'accepted' })
        .eq('following_id', currentUserId)
        .eq('status', 'pending');

      if (error) throw error;

      setRequests([]);

      toast({
        title: "All requests accepted",
        description: "All pending follow requests have been accepted.",
      });

      onRequestUpdate?.();
    } catch (error) {
      console.error('Error accepting all requests:', error);
      toast({
        title: "Error",
        description: "Failed to accept all requests. Please try again.",
        variant: "destructive",
      });
    }
  };

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
              {requests.length} pending request{requests.length !== 1 ? 's' : ''}
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
        {requests.map((request) => (
          <div key={request.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={request.follower.avatar_url} alt={request.follower.display_name} />
                <AvatarFallback>{request.follower.display_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{request.follower.display_name}</span>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">@{request.follower.username}</p>
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
                onClick={() => handleRequestAction(request.id, 'accept')}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequestAction(request.id, 'decline')}
              >
                <UserX className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
