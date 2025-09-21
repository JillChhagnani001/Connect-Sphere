"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  Settings,
  Bell,
  MessageSquare,
  Compass,
  Star,
  LineChart
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import placeholderData from "@/lib/placeholder-data";
import { Badge } from "./ui/badge";

const navItems = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/analytics", icon: LineChart, label: "Analytics" },
  { href: "/messages", icon: MessageSquare, label: "Messages"},
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function Sidebar({ isSheet = false }: { isSheet?: boolean }) {
  const pathname = usePathname();
  const profile = placeholderData.users[0]; // Use the first mock user as the current user
  
  const finalNavItems = navItems.map(item => {
    if (item.label === "Profile") {
      return { ...item, href: profile ? `/profile/${profile.username}` : '/login' };
    }
    return item;
  });

  return (
    <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex-col bg-sidebar text-sidebar-foreground",
        isSheet ? "w-full" : "hidden w-72 lg:flex"
    )}>
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center gap-3 p-4">
          <Logo className="h-8 w-8" />
          <h1 className="text-2xl font-bold tracking-tight">ConnectSphere</h1>
        </div>
        
        <nav className="flex flex-col gap-1 p-2">
          {finalNavItems.map((item) => {
            const isActive = item.href === '/feed' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link href={item.href} key={item.label}>
                <Button
                  variant={isActive ? "accent" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 px-3 py-5 text-base rounded-lg",
                    !isActive && "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    isActive && "font-bold bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto space-y-4 p-2">
           {profile && (
             <Link href={`/profile/${profile.username}`}>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/50 cursor-pointer">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url} alt="User Avatar" data-ai-hint="user avatar" />
                    <AvatarFallback>{profile.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{profile.display_name}</span>
                    <span className="text-sm opacity-80">@{profile.username}</span>
                  </div>
                </div>
              </Link>
           )}
        </div>
      </div>
    </aside>
  );
}
