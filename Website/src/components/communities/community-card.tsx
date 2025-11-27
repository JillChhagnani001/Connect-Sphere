"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Users, Lock, IndianRupee, Calendar } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Community } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { PaymentModal } from "./payment-modal";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CommunityCardProps {
  community: Community;
  isMember?: boolean;
  onJoin?: (community: Community) => void;
  onLeave?: (community: Community) => void;
}

export function CommunityCard({ community, isMember = false, onJoin, onLeave }: CommunityCardProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const router = useRouter();

  const handleJoin = () => {
    // For paid communities, show payment modal
    if (community.membership_type === 'paid' && community.price && !isMember) {
      setShowPaymentModal(true);
      return;
    }
    
    // For free communities or if onJoin is provided, use the callback
    if (onJoin) {
      onJoin(community);
    }
  };

  const handleLeave = () => {
    if (!onLeave) {
      return;
    }

    setShowLeaveDialog(true);
  };

  const confirmLeave = () => {
    if (!onLeave) {
      return;
    }

    onLeave(community);
    setShowLeaveDialog(false);
  };

  const handlePaymentSuccess = () => {
    router.push(`/communities/${community.slug}`);
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {community.cover_image_url && (
        <div className="relative h-32 w-full">
          <Image
            src={community.cover_image_url}
            alt={community.name}
            fill
            className="object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border-2 border-background">
            <AvatarImage src={community.avatar_url || undefined} alt={community.name} />
            <AvatarFallback>{community.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <Link href={`/communities/${community.slug}`}>
              <h3 className="font-semibold text-lg hover:underline truncate">
                {community.name}
              </h3>
            </Link>
            {community.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {community.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{community.member_count} members</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{community.post_count} posts</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {community.membership_type === 'paid' ? (
            <Badge variant="secondary" className="gap-1">
              <IndianRupee className="h-3 w-3" />
              <span>₹{community.price ? community.price.toFixed(0) : '0'}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              <span>Free</span>
            </Badge>
          )}
          {community.is_active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        {isMember ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLeave}
          >
            Leave Community
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={!community.is_active}
          >
            {community.membership_type === 'paid' ? 'Join (Paid)' : 'Join Community'}
          </Button>
        )}
      </CardFooter>
      {community.membership_type === 'paid' && community.price && !isMember && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          communityId={community.id}
          communityName={community.name}
          amount={community.price}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {isMember && (
        <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave community?</DialogTitle>
              <DialogDescription>
                Are you sure you want to leave {community.name}? You will lose access to its posts and content.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowLeaveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmLeave}
              >
                Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

