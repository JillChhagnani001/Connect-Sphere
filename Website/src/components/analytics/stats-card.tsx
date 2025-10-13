import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: string;
  trendDirection?: "up" | "down";
};

export function StatsCard({ title, value, icon: Icon, trend, trendDirection = "up" }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={cn(
          "text-xs text-muted-foreground flex items-center",
          trendDirection === "up" ? "text-emerald-500" : "text-red-500"
        )}>
          {trendDirection === "up" ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
          {trend}
        </p>
      </CardContent>
    </Card>
  );
}
