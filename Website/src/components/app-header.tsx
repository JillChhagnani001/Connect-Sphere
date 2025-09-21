"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, PlusSquare, Bell, MessageSquare, Settings, Menu } from "lucide-react"
import { Logo } from "./logo"
import Link from "next/link"
import placeholderData from "@/lib/placeholder-data"
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet"
import { Sidebar } from "./sidebar"

export function AppHeader() {
  const profile = placeholderData.users[0]; // Use the first mock user as the current user

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="hidden lg:flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <h1 className="text-2xl font-bold tracking-tight">ConnectSphere</h1>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <Sidebar isSheet />
        </SheetContent>
      </Sheet>
      
      <div className="flex-1 flex justify-center px-4">
        <div className="w-full max-w-md">
          <form>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-full bg-card pl-10 rounded-full"
                placeholder="Search..."
              />
            </div>
          </form>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button className="rounded-full hidden sm:flex">
          <PlusSquare className="h-5 w-5 mr-2" />
          Add New Post
        </Button>
         <Button size="icon" className="rounded-full sm:hidden">
          <PlusSquare className="h-5 w-5" />
          <span className="sr-only">Add New Post</span>
        </Button>
        
        <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
                <MessageSquare className="h-5 w-5" />
                <span className="sr-only">Messages</span>
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
            </Button>
             <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
            </Button>
        </div>
        {profile && (
          <Link href={`/profile/${profile.username}`}>
            <Avatar className="h-9 w-9">
               <AvatarImage src={profile.avatar_url} alt="User Avatar" data-ai-hint="user avatar" />
              <AvatarFallback>{profile.display_name?.[0]}</AvatarFallback>
            </Avatar>
          </Link>
        )}
      </div>
    </header>
  )
}
