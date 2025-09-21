import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import placeholderData from "@/lib/placeholder-data";

export function Stories() {
    const users = placeholderData.users.slice(0, 7);

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center space-x-4 overflow-x-auto pb-2">
                    {users.map((user, index) => (
                        <div key={user.id} className="flex flex-col items-center space-y-1.5 flex-shrink-0">
                            <Avatar className="h-16 w-16 border-2 border-primary p-0.5">
                                <AvatarImage src={`https://picsum.photos/seed/story${index}/200`} alt={user.display_name} data-ai-hint="user story" />
                                <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium">{user.username}</span>
                        </div>
                    ))}
                     <div className="flex flex-col items-center space-y-1.5 flex-shrink-0">
                        <Avatar className="h-16 w-16 border-2 border-dashed border-muted-foreground p-0.5 flex items-center justify-center bg-muted/50">
                            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </Avatar>
                        <span className="text-xs font-medium">Add Story</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
