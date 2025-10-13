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
import { Badge } from "./ui/badge";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types";

const navItems = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/analytics", icon: LineChart, label: "Analytics" },
  { href: "/messages", icon: MessageSquare, label: "Messages", badge: 3 },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function Sidebar({ isSheet = false }: { isSheet?: boolean }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ profile: UserProfile } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profile) {
          setUser({ profile });
        }
      }
    };
    fetchUser();
  }, [pathname]); // Refetch on path change

  const finalNavItems = navItems.map(item => {
    if (item.label === "Profile") {
      const username = user?.profile?.username;
      const safeHref = username && username !== 'null' && username !== ''
        ? `/profile/${username}`
        : '/settings';
      return { ...item, href: safeHref };
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
                  {item.badge && <Badge className="ml-auto bg-primary text-primary-foreground">{item.badge}</Badge>}
                </Button>
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto space-y-4 p-2">
            <div className="p-4 bg-sidebar-accent/30 rounded-lg text-center">
                <h4 className="font-semibold text-sidebar-foreground">Unlock Pro</h4>
                <p className="text-sm opacity-80 mt-1 mb-3">Get more features and customize your profile.</p>
                <Button variant="accent" className="w-full">
                    <Star className="h-4 w-4 mr-2" /> Go Pro
                </Button>
            </div>
           {user && user.profile && (
             <Link href={user.profile.username && user.profile.username !== 'null' && user.profile.username !== '' ? `/profile/${user.profile.username}` : "/settings"}>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/50 cursor-pointer">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.profile.avatar_url!} alt="User Avatar" data-ai-hint="user avatar" />
                    <AvatarFallback>{user.profile.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{user.profile.display_name}</span>
                    <span className="text-sm opacity-80">@{user.profile.username}</span>
                  </div>
                </div>
              </Link>
           )}
        </div>
      </div>
    </aside>
  );
}
