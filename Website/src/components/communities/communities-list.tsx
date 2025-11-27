"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CommunityCard } from "./community-card";
import { useToast } from "@/hooks/use-toast";
import { joinCommunity, leaveCommunity } from "@/app/communities/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CommunitiesListProps {
  communities: any[];
  memberCommunityIds: Set<number>;
}

export function CommunitiesList({ communities, memberCommunityIds }: CommunitiesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid" | "my">("all");
  const router = useRouter();
  const { toast } = useToast();

  const handleJoin = async (community: any) => {
    // This will only be called for free communities
    // Paid communities will use the PaymentModal directly
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
      router.push(`/communities/${community.slug}`);
    }
  };

  const handleLeave = async (community: any) => {
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

  // Filter communities
  const q = searchQuery.trim().toLowerCase();
  const filteredCommunities = communities.filter((community) => {
    // Search filter across name, description, and slug
    const name = community.name?.toLowerCase() || "";
    const desc = community.description?.toLowerCase() || "";
    const slug = (community as any).slug?.toLowerCase() || "";
    const matchesSearch = q === "" || name.includes(q) || desc.includes(q) || slug.includes(q);

    // Type filter
    let matchesFilter = true;
    if (filter === "free") {
      matchesFilter = community.membership_type === "free";
    } else if (filter === "paid") {
      matchesFilter = community.membership_type === "paid";
    } else if (filter === "my") {
      matchesFilter = memberCommunityIds.has(community.id);
    }

    return matchesSearch && matchesFilter;
  });

  // In the "All" tab we should show ALL filtered communities regardless of membership
  const allCommunities = filteredCommunities;
  const myCommunities = filteredCommunities.filter((c) => memberCommunityIds.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="free">Free</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="my">My</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {allCommunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {allCommunities.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={memberCommunityIds.has(community.id)}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No communities found</p>
              <p className="text-sm mt-2">
                {searchQuery ? "Try adjusting your search" : "Be the first to create a community!"}
              </p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="free" className="mt-4">
          {filteredCommunities.filter(c => c.membership_type === 'free').length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredCommunities.filter(c => c.membership_type === 'free').map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={memberCommunityIds.has(community.id)}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No free communities found</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="paid" className="mt-4">
          {filteredCommunities.filter(c => c.membership_type === 'paid').length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredCommunities.filter(c => c.membership_type === 'paid').map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={memberCommunityIds.has(community.id)}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No paid communities found</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="my" className="mt-4">
          {myCommunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {myCommunities.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={true}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">You haven't joined any communities yet</p>
              <p className="text-sm mt-2">Explore communities above to get started</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

