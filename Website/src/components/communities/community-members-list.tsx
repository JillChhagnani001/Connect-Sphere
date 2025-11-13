"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CommunityMember } from "@/lib/types";
import { Crown, Shield, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { updateMemberRole } from "@/app/communities/actions";

interface CommunityMembersListProps {
  members: CommunityMember[];
  communityId: number;
  canManageRoles?: boolean;
}

export function CommunityMembersList({ members, communityId, canManageRoles = false }: CommunityMembersListProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-3 w-3" />;
      case 'co_owner':
        return <Crown className="h-3 w-3" />;
      case 'admin':
      case 'moderator':
        return <Shield className="h-3 w-3" />;
      default:
        return <UserCheck className="h-3 w-3" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'co_owner':
        return 'secondary';
      case 'admin':
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleToggleCoOwner = (member: CommunityMember) => {
    const nextRole = member.role === 'co_owner' ? 'member' : 'co_owner';

    startTransition(async () => {
      const result = await updateMemberRole(communityId, member.user_id, nextRole);

      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
        return;
      }

      toast({
        title: "Success",
        description: nextRole === 'co_owner'
          ? `${member.user?.display_name || 'Member'} is now a co-owner`
          : `${member.user?.display_name || 'Member'} is no longer a co-owner`,
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.slice(0, 20).map((member) => (
            <Link
              key={member.id}
              href={`/profile/${member.user?.username || member.user_id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.user?.avatar_url || undefined} alt={member.user?.display_name || 'User'} />
                <AvatarFallback>{member.user?.display_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{member.user?.display_name || 'User'}</span>
                  {member.role !== 'member' && (
                    <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1 text-xs">
                      {getRoleIcon(member.role)}
                      <span className="capitalize">{member.role.replace('_', ' ')}</span>
                    </Badge>
                  )}
                </div>
                {member.user?.username && (
                  <span className="text-sm text-muted-foreground">@{member.user.username}</span>
                )}
              </div>
              {canManageRoles && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleToggleCoOwner(member);
                  }}
                  disabled={isPending}
                >
                  {member.role === 'co_owner' ? 'Remove co-owner' : 'Make co-owner'}
                </Button>
              )}
            </Link>
          ))}
          {members.length > 20 && (
            <p className="text-sm text-muted-foreground text-center pt-2">
              +{members.length - 20} more members
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

