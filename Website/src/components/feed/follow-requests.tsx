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
import type { FollowRequest as FollowRequestType, UserProfile } from "@/lib/types"; // Use new type

interface FollowRequest extends FollowRequestType {
  follower: UserProfile;
}

interface FollowRequestsProps {
  currentUserId: string;
  onRequestUpdate?: () => void;
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
        .from('follow_requests')
        .select(`
          *,
          follower:profiles!follow_requests_follower_id_fkey(*)
        `)
        .eq('following_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as FollowRequest[] || []);
    } catch (error) {
      console.error('Error fetching follow requests:', error);
      toast({ title: "Error", description: "Failed to load follow requests.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAction = async (request: FollowRequest, action: 'accept' | 'decline') => {
    try {
      const supabase = createClient();
      
      // 1. Delete the request from 'follow_requests'
      const { error: deleteError } = await supabase
        .from('follow_requests')
        .delete()
        .eq('id', request.id);
      if (deleteError) throw deleteError;
      
      if (action === 'accept') {
        const { error: insertError } = await supabase
          .from('followers')
          .insert({
            follower_id: request.follower_id,
            following_id: request.following_id,
          });
        if (insertError) throw insertError;
        toast({ title: "Request accepted" });
      } else {
        toast({ title: "Request declined" });
      }

      setRequests(prev => prev.filter(req => req.id !== request.id));
      onRequestUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to ${action} request. ${error.message}`, variant: "destructive" });
    }
  };

  const handleAcceptAll = async () => {
    try {
      const supabase = createClient();
      const pendingRequests = [...requests];
      if (pendingRequests.length === 0) return;

      const newFollowers = pendingRequests.map(req => ({
        follower_id: req.follower_id,
        following_id: req.following_id,
      }));

      const { error: insertError } = await supabase
        .from('followers')
        .insert(newFollowers);
      if (insertError) throw insertError;

      const requestIds = pendingRequests.map(req => req.id);
      const { error: deleteError } = await supabase
        .from('follow_requests')
        .delete()
        .in('id', requestIds);
      if (deleteError) throw deleteError;
      
      setRequests([]);
      toast({ title: "All requests accepted" });
      onRequestUpdate?.();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to accept all requests. ${error.message}`, variant: "destructive" });
    }
  };
  
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Follow Requests</CardTitle></CardHeader>
        <CardContent><div className="text-center py-4">Loading...</div></CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follow Requests</CardTitle>
          <CardDescription>People who want to follow you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
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
            <CardTitle>Follow Requests</CardTitle>
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
                <AvatarFallback>{request.follower.display_name?.charAt(0)||"U"}</AvatarFallback>
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
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleRequestAction(request, 'accept')}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequestAction(request, 'decline')}
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