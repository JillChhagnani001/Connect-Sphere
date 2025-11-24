"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { removeCommunityMember, updateMemberRole } from "@/app/communities/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { CommunityMember } from "@/lib/types";

interface CommunityMembersManagerProps {
  members: CommunityMember[];
  communityId: number;
  viewerRole: CommunityMember["role"] | null;
  viewerId: string;
}

function canRemoveMember(
  viewerRole: CommunityMembersManagerProps["viewerRole"],
  memberRole: CommunityMember["role"],
  isSelf: boolean
) {
  if (!viewerRole || isSelf) return false;
  if (viewerRole === "owner") {
    return memberRole !== "owner";
  }
  if (viewerRole === "co_owner") {
    return memberRole !== "owner" && memberRole !== "co_owner";
  }
  return false;
}

export function CommunityMembersManager({
  members,
  communityId,
  viewerRole,
  viewerId,
}: CommunityMembersManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const getBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "co_owner":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleToggleCoOwner = (member: CommunityMember) => {
    if (viewerRole !== "owner" || member.role === "owner" || member.user_id === viewerId) {
      return;
    }

    const nextRole = member.role === "co_owner" ? "member" : "co_owner";
    const displayName =
      member.user?.display_name || member.user?.username || "Member";

    setRoleUpdatingId(member.user_id);
    startTransition(async () => {
      const result = await updateMemberRole(communityId, member.user_id, nextRole);

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Unable to update role",
          description: result.error,
        });
        setRoleUpdatingId(null);
        return;
      }

      toast({
        title: "Role updated",
        description:
          nextRole === "co_owner"
            ? `${displayName} is now a co-owner`
            : `${displayName} is no longer a co-owner`,
      });
      setRoleUpdatingId(null);
      router.refresh();
    });
  };

  const handleRemove = (member: CommunityMember) => {
    const canRemove = canRemoveMember(viewerRole, member.role, member.user_id === viewerId);
    if (!canRemove) return;

    const displayName =
      member.user?.display_name || member.user?.username || "Member";

    setRemovingId(member.user_id);
    startTransition(async () => {
      const result = await removeCommunityMember(communityId, member.user_id);

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Unable to remove member",
          description: result.error,
        });
        setRemovingId(null);
        return;
      }

      toast({
        title: "Member removed",
        description: `${displayName} has been removed from the community`,
      });

      setRemovingId(null);
      router.refresh();
    });
  };

  return (
    <div className="divide-y">
      {members.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No members yet.</div>
      ) : (
        members.map((member) => {
          const showRemoveButton = canRemoveMember(
            viewerRole,
            member.role,
            member.user_id === viewerId
          );

          return (
            <div key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.user?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {(member.user?.display_name || member.user?.username || "U").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {member.user?.display_name || member.user?.username || "Unknown user"}
                  </span>
                  {(member.role === "owner" || member.role === "co_owner") && (
                    <Badge variant={getBadgeVariant(member.role)} className="capitalize">
                      {member.role.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                {member.user?.username && (
                  <span className="text-sm text-muted-foreground truncate">
                    @{member.user.username}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {viewerRole === "owner" &&
                  member.role !== "owner" &&
                  member.user_id !== viewerId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={roleUpdatingId === member.user_id}
                      onClick={() => handleToggleCoOwner(member)}
                    >
                      {roleUpdatingId === member.user_id
                        ? "Updating..."
                        : member.role === "co_owner"
                          ? "Remove co-owner"
                          : "Make co-owner"}
                    </Button>
                  )}
                {showRemoveButton && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={isPending && removingId === member.user_id}
                      >
                        {isPending && removingId === member.user_id ? "Removing..." : "Remove"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove member</AlertDialogTitle>
                      </AlertDialogHeader>
                      <p className="text-sm text-muted-foreground">
                        {`Are you sure you want to remove ${
                          member.user?.display_name || member.user?.username || "this member"
                        } from the community?`}
                      </p>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(member)}>
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
