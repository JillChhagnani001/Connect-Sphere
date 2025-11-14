"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { joinCommunity, leaveCommunity } from "@/app/communities/actions";
import type { Community } from "@/lib/types";
import { LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { PaymentModal } from "./payment-modal";

interface CommunityActionsProps {
  community: Community;
  isMember: boolean;
  isOwner: boolean;
}

export function CommunityActions({ community, isMember, isOwner }: CommunityActionsProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleJoin = async () => {
    // For paid communities, show payment modal
    if (community.membership_type === 'paid' && community.price) {
      setShowPaymentModal(true);
      return;
    }

    // For free communities, join directly
    const result = await joinCommunity(community.id);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      });
    } else {
      toast({
        title: "Success",
        description: "You have joined the community!",
      });
      router.refresh();
    }
  };

  const handleLeave = async () => {
    const result = await leaveCommunity(community.id);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      });
    } else {
      toast({
        title: "Success",
        description: "You have left the community",
      });
      router.refresh();
    }
  };

  const handlePaymentSuccess = () => {
    router.refresh();
  };

  if (isOwner) {
    return null;
  }

  if (isMember) {
    return (
      <Button variant="outline" onClick={handleLeave} className="gap-2">
        <LogOut className="h-4 w-4" />
        Leave
      </Button>
    );
  }

  return (
    <>
      <Button onClick={handleJoin} className="gap-2">
        <UserPlus className="h-4 w-4" />
        {community.membership_type === 'paid' ? 'Join (Paid)' : 'Join Community'}
      </Button>
      {community.membership_type === 'paid' && community.price && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          communityId={community.id}
          communityName={community.name}
          amount={community.price}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}

