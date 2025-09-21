import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";

const users = [
  {
    name: "Julia Smith",
    username: "juliasmith",
    avatarUrl: "https://picsum.photos/id/1011/50",
  },
  {
    name: "Vermillion D. Gray",
    username: "vermilliongray",
    avatarUrl: "https://picsum.photos/id/1012/50",
  },
  {
    name: "Mai Senpai",
    username: "maisenpai",
    avatarUrl: "https://picsum.photos/id/1013/50",
  },
    {
    name: "Azunyan U. Wu",
    username: "azunyandesu",
    avatarUrl: "https://picsum.photos/id/1014/50",
  },
    {
    name: "Oarack Babama",
    username: "obama21",
    avatarUrl: "https://picsum.photos/id/1015/50",
  },
];

export function FriendSuggestions() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">Friend Suggestions</CardTitle>
        <Link href="#" className="text-sm text-primary font-semibold flex items-center gap-1">
            See All <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {users.map(user => (
          <div key={user.username} className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
               <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar" />
               <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">{user.name}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <Plus className="h-4 w-4"/>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
