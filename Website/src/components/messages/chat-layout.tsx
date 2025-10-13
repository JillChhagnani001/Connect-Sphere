"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "@/lib/utils";

const conversations = [
  { id: 0, name: 'Friend 1', avatarUrl: 'https://picsum.photos/id/70/50', lastMessage: "Hey, what's up? Let's catch up later!", timestamp: '10m ago', unread: 2 },
  { id: 1, name: 'Friend 2', avatarUrl: 'https://picsum.photos/id/71/50', lastMessage: "Just saw your new post, looks great!", timestamp: '1h ago', unread: 0 },
  { id: 2, name: 'Friend 3', avatarUrl: 'https://picsum.photos/id/72/50', lastMessage: "Are we still on for tomorrow?", timestamp: '3h ago', unread: 0 },
  { id: 3, name: 'Friend 4', avatarUrl: 'https://picsum.photos/id/73/50', lastMessage: "Happy Birthday! 🎂", timestamp: '1d ago', unread: 1 },
  { id: 4, name: 'Friend 5', avatarUrl: 'https://picsum.photos/id/74/50', lastMessage: "Can you send me that file?", timestamp: '2d ago', unread: 0 },
  { id: 5, name: 'Friend 6', avatarUrl: 'https://picsum.photos/id/75/50', lastMessage: "Long time no see!", timestamp: '5d ago', unread: 0 },
];


const messages = [
    { id: 1, sender: 'other', content: 'Hey, how are you?' },
    { id: 2, sender: 'me', content: 'I am good, thanks! How about you?' },
    { id: 3, sender: 'other', content: 'Doing great. Seen the new ConnectSphere update?' },
    { id: 4, sender: 'me', content: 'Yeah, it looks amazing! The new UI is so clean.' },
    { id: 5, sender: 'other', content: 'Totally agree. The performance is way better too.' },
];

export function ChatLayout() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [isChatVisible, setIsChatVisible] = useState(false);

  const handleSelectConversation = (convo: typeof conversations[0]) => {
    setSelectedConversation(convo);
    setIsChatVisible(true);
  }

  return (
    <div className="flex h-full border rounded-lg bg-card overflow-hidden relative">
      <div className={cn("w-full md:w-1/3 border-r transition-transform duration-300 ease-in-out", isChatVisible ? "-translate-x-full md:translate-x-0" : "translate-x-0")}>
        <ScrollArea className="h-full">
          <div className="p-4">
            <h2 className="text-xl font-semibold mb-4 hidden md:block">Chats</h2>
            <div className="space-y-2">
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50",
                    selectedConversation.id === convo.id && "bg-muted"
                  )}
                  onClick={() => handleSelectConversation(convo)}
                >
                  <Avatar>
                    <AvatarImage src={convo.avatarUrl} alt={convo.name} data-ai-hint="user avatar" />
                    <AvatarFallback>{convo.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{convo.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
                  </div>
                  <div className="flex flex-col items-end text-xs text-muted-foreground">
                    <span>{convo.timestamp}</span>
                    {convo.unread > 0 && (
                      <span className="mt-1 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                        {convo.unread}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
      <div className={cn("absolute top-0 left-0 w-full h-full md:static md:w-2/3 flex flex-col transition-transform duration-300 ease-in-out", isChatVisible ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
        <div className="p-4 border-b flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsChatVisible(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar>
            <AvatarImage src={selectedConversation.avatarUrl} alt={selectedConversation.name} data-ai-hint="user avatar" />
            <AvatarFallback>{selectedConversation.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold">{selectedConversation.name}</h3>
        </div>
        <ScrollArea className="flex-1 p-6 bg-background">
            <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-end gap-2",
                  msg.sender === "me" ? "justify-end" : "justify-start"
                )}
              >
                {msg.sender === 'other' && <Avatar className="h-8 w-8"><AvatarImage src={selectedConversation.avatarUrl} data-ai-hint="user avatar" /></Avatar>}
                <div
                  className={cn(
                    "max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2",
                    msg.sender === "me"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
            </div>
        </ScrollArea>
        <div className="p-4 border-t bg-card">
          <div className="relative">
            <Input placeholder="Type a message..." className="pr-20" />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                <Button variant="ghost" size="icon">
                    <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon">
                    <Send className="h-5 w-5 text-primary" />
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
