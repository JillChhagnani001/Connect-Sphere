import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, MoreHorizontal } from "lucide-react";
import placeholderData from "@/lib/placeholder-data";


export function ProfileActivity() {
    const users = placeholderData.users;
    
    return (
        <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">Profile Activity</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        </CardHeader>
        <CardContent className="text-center">
            <div className="flex -space-x-2 justify-center">
                {users.map((user, i) => (
                    <Avatar key={user.id} className="h-10 w-10 border-2 border-card">
                        <AvatarImage src={user.avatar_url} alt={user.display_name} data-ai-hint="user avatar" />
                        <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                ))}
                <Avatar className="h-10 w-10 border-2 border-card bg-muted flex items-center justify-center">
                    <span className="text-xs font-semibold">+5</span>
                </Avatar>
            </div>
            <p className="text-2xl font-bold mt-3">+1,158 <span className="text-base font-normal text-muted-foreground">Followers</span></p>
            <p className="text-xs text-emerald-500 flex items-center justify-center gap-1 mt-1">
                <ArrowUp className="h-3 w-3" />
                23% vs last month
            </p>
            <p className="text-sm text-muted-foreground mt-2">You gained a substantial amount of followers this month!</p>
        </CardContent>
        </Card>
    )
}
