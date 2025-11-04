"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CommunityMember } from "@/lib/types";
import { Crown, Shield, UserCheck } from "lucide-react";

interface CommunityMembersListProps {
  members: CommunityMember[];
}

export function CommunityMembersList({ members }: CommunityMembersListProps) {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
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
      case 'admin':
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
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
                      <span className="capitalize">{member.role}</span>
                    </Badge>
                  )}
                </div>
                {member.user?.username && (
                  <span className="text-sm text-muted-foreground">@{member.user.username}</span>
                )}
              </div>
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

