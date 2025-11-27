"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { joinCommunity, leaveCommunity, deleteCommunity } from "@/app/communities/actions";
import type { Community } from "@/lib/types";
import { LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { PaymentModal } from "./payment-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CommunityActionsProps {
  community: Community;
  isMember: boolean;
  isOwner: boolean;
}

export function CommunityActions({ community, isMember, isOwner }: CommunityActionsProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
      router.push('/communities');
    }
  };

  const handleDelete = async () => {
    const result = await deleteCommunity(community.id);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error,
      });
    } else {
      toast({
        title: "Community deleted",
        description: "Your community has been deleted successfully.",
      });
      router.push('/communities');
    }
  };

  const handlePaymentSuccess = () => {
    router.refresh();
  };

  if (isOwner) {
    return (
      <>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          className="gap-2"
        >
          Delete Community
        </Button>
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete community?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete {community.name} and all of its content.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await handleDelete();
                  setShowDeleteDialog(false);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (isMember) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setShowLeaveDialog(true)}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Leave
        </Button>
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
                onClick={async () => {
                  await handleLeave();
                  setShowLeaveDialog(false);
                }}
              >
                Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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

