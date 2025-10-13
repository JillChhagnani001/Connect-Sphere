import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Bell, MoreHorizontal } from "lucide-react";

export function UpcomingEvents() {
    return (
        <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">Upcoming Events</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
            </Button>
        </CardHeader>
        <CardContent>
            <div className="flex items-center p-3 bg-accent/50 rounded-lg">
                <div className="p-2 bg-white rounded-lg mr-4">
                     <Gift className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-sm">Friend's Birthday</p>
                    <p className="text-xs text-muted-foreground">Jun 25, 2028</p>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                </Button>
            </div>
        </CardContent>
        </Card>
    )
}
