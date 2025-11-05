
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile, ArrowLeft, MoreHorizontal, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import type { Conversation, Message, UserProfile } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "../ui/skeleton";
import { NewChatDialog } from "./new-chat-dialog";

type EnrichedConversation = Omit<Conversation, 'participants'> & {
  participants: { data: UserProfile[] };
  other_participant: UserProfile;
};

export function ChatLayout() {
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<EnrichedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const routerUserHandled = useRef(false);

  const getOtherParticipant = useCallback((convo: EnrichedConversation, currentUserId: string) => {
    return convo.participants.data.find(p => p.id !== currentUserId);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        setTimeout(() => {
          viewport.scrollTop = viewport.scrollHeight;
        }, 100);
      }
    }
  }, []);

  const fetchConversations = useCallback(async (userId: string) => {
    setIsLoading(true);
    const supabase = createClient();
    try {
      const { data: participantRecords, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (participantError) throw participantError;
      if (!participantRecords || participantRecords.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }
      
      const conversationIds = participantRecords.map(p => p.conversation_id);
      
      const { data: convosData, error: convosError } = await supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          participants:conversation_participants(
            profile:profiles!conversation_participants_user_id_fkey(id, display_name, username, avatar_url)
          ),
          last_message:messages(
            content,
            created_at,
            sender:profiles!messages_sender_fkey(id, display_name, username, avatar_url)
          )
        `)
        .in('id', conversationIds)
        .order('created_at', { referencedTable: 'messages', ascending: false })

      if (convosError) throw convosError;

      const enrichedConvos = (convosData || []).map(c => {
        const participantsData = c.participants.map((p: any) => p.profile);
        const otherParticipant = participantsData.find((p: any) => p.id !== userId);
        return {
          ...c,
          participants: { data: participantsData },
          last_message: c.last_message.length > 0 ? c.last_message[0] : null,
          other_participant: otherParticipant,
          unread_count: 0,
        };
      }).filter(c => c.other_participant);

      setConversations(enrichedConvos as EnrichedConversation[]);
    } catch (e) {
      console.error("Error fetching conversations:", e);
      toast({ title: "Error", description: "Could not fetch conversations.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleSelectConversation = useCallback((convo: EnrichedConversation) => {
    setSelectedConversation(convo);
    setIsChatVisible(true);
  }, []);

  const fetchMessages = useCallback(async (conversationId: number) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_fkey(*)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      setMessages(data as Message[]);
      scrollToBottom();
    } catch(e) {
      console.error("Error fetching messages:", e);
      toast({ title: "Error", description: "Could not fetch messages.", variant: "destructive" });
    }
  }, [toast, scrollToBottom]);

  const openConversationWithUser = useCallback(async (targetUserId: string) => {
    if (!currentUser) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      // Step 1: Find conversations this user is in.
      const { data: userConvos, error: userConvosError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

      if (userConvosError) throw userConvosError;
      const userConvoIds = userConvos.map(c => c.conversation_id);

      // Step 2: Find conversations the other user is in.
      const { data: targetConvos, error: targetConvosError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId);
      
      if (targetConvosError) throw targetConvosError;
      const targetConvoIds = targetConvos.map(c => c.conversation_id);

      // Step 3: Find the intersection
      const sharedConvoId = userConvoIds.find(id => targetConvoIds.includes(id));
      let finalConvo = conversations.find(c => c.id === sharedConvoId);

      if (sharedConvoId && !finalConvo) {
         // If it exists but isn't in our local state, refetch the list
         await fetchConversations(currentUser.id);
         finalConvo = conversations.find(c => c.id === sharedConvoId);
      }
      
      if (finalConvo) {
          handleSelectConversation(finalConvo);
      } else {
        // Step 4: Create new conversation if none found
        const { data: newConvo, error: createConvoError } = await supabase
          .from('conversations')
          .insert({})
          .select()
          .single();
        if (createConvoError) throw createConvoError;
        
        const { error: participantsError } = await supabase
          .from('conversation_participants')
          .insert([
            { conversation_id: newConvo.id, user_id: currentUser.id },
            { conversation_id: newConvo.id, user_id: targetUserId },
          ]);
        if (participantsError) throw participantsError;
        
        // Refetch all conversations to get the new one
        await fetchConversations(currentUser.id);
      }
    } catch (e) {
      console.error("Error opening conversation:", e);
      toast({ title: "Error", description: "Could not open conversation.", variant: "destructive" });
    } finally {
       setIsLoading(false);
    }

  }, [currentUser, conversations, fetchConversations, handleSelectConversation, toast]);
  
  useEffect(() => {
    if (currentUser) {
      fetchConversations(currentUser.id);
    }
  }, [currentUser, fetchConversations]);

  useEffect(() => {
    if (currentUser && !isLoading && !routerUserHandled.current) {
      const targetUserId = searchParams.get('userId');
      if (targetUserId) {
        routerUserHandled.current = true;
        openConversationWithUser(targetUserId);
      }
    }
  }, [searchParams, currentUser, isLoading, openConversationWithUser]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      
      const supabase = createClient();
      const channel = supabase.channel(`messages-conv-${selectedConversation.id}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${selectedConversation.id}` 
          }, 
          async (payload) => {
            await fetchMessages(selectedConversation.id);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, fetchMessages]);
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;
    
    setIsSending(true);
    try {
        const supabase = createClient();
        const { error } = await supabase.from('messages').insert({
            conversation_id: selectedConversation.id,
            sender: currentUser.id,
            content: newMessage.trim(),
        });
        
        if (error) throw error;
        
        setNewMessage("");
        // No need to manually refetch, the real-time subscription will handle it.
    } catch (e) {
        console.error("Error sending message:", e);
        toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    } finally {
        setIsSending(false);
    }
  };
  
  if (isLoading && conversations.length === 0) {
     return (
       <div className="flex h-full border rounded-lg bg-card overflow-hidden">
         <div className="w-full md:w-1/3 border-r p-4 space-y-2">
            {Array.from({length: 6}).map((_,i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
            ))}
         </div>
          <div className="hidden md:flex md:w-2/3 flex-col">
            <div className="p-4 border-b flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-1/4" />
            </div>
            <div className="flex-1 p-6" />
            <div className="p-4 border-t">
                <Skeleton className="h-10 w-full" />
            </div>
          </div>
       </div>
     );
  }

  const currentParticipant = selectedConversation && currentUser ? getOtherParticipant(selectedConversation, currentUser.id) : null;

  return (
    <>
    <NewChatDialog
      isOpen={isNewChatOpen}
      onClose={() => setIsNewChatOpen(false)}
      onChatStarted={(userId) => {
        openConversationWithUser(userId);
        setIsNewChatOpen(false);
      }}
    />
    <div className="flex h-full border rounded-lg bg-card overflow-hidden relative">
      <div className={cn("w-full md:w-1/3 border-r transition-transform duration-300 ease-in-out", isChatVisible ? "-translate-x-full md:translate-x-0" : "translate-x-0")}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold hidden md:block">Chats</h2>
          <Button size="icon" variant="ghost" onClick={() => setIsNewChatOpen(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-4.5rem)]">
          <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                  <p className="mb-2">No conversations yet.</p>
                  <Button onClick={() => setIsNewChatOpen(true)}>Start a new chat</Button>
                </div>
              ) : conversations.map((convo) => {
                if (!currentUser) return null;
                const otherUser = getOtherParticipant(convo, currentUser.id);
                if (!otherUser) return null;
                return (
                  <div
                    key={convo.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50",
                      selectedConversation?.id === convo.id && "bg-muted"
                    )}
                    onClick={() => handleSelectConversation(convo)}
                  >
                    <Avatar>
                      <AvatarImage src={otherUser.avatar_url} alt={otherUser.display_name} data-ai-hint="user avatar" />
                      <AvatarFallback>{otherUser.display_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold truncate">{otherUser.display_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{convo.last_message?.content}</p>
                    </div>
                    <div className="flex flex-col items-end text-xs text-muted-foreground">
                      <span>{convo.last_message ? formatDistanceToNow(new Date(convo.last_message.created_at), { addSuffix: true }) : ''}</span>
                      {convo.unread_count > 0 && (
                        <span className="mt-1 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                          {convo.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
        </ScrollArea>
      </div>
      <div className={cn("absolute top-0 left-0 w-full h-full md:static md:w-2/3 flex flex-col transition-transform duration-300 ease-in-out bg-background", isChatVisible ? "translate-x-0" : "translate-x-full md:translate-x-0")}>
        {selectedConversation && currentParticipant ? (
            <>
            <div className="p-4 border-b flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsChatVisible(false)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar>
                        <AvatarImage src={currentParticipant.avatar_url} alt={currentParticipant.display_name} data-ai-hint="user avatar" />
                        <AvatarFallback>{currentParticipant.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-semibold">{currentParticipant.display_name}</h3>
                </div>
                <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                </Button>
            </div>
            <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
                <div className="space-y-4">
                {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={cn(
                    "flex items-end gap-2",
                    msg.sender.id === currentUser?.id ? "justify-end" : "justify-start"
                    )}
                >
                    {msg.sender.id !== currentUser?.id && <Avatar className="h-8 w-8"><AvatarImage src={msg.sender.avatar_url} data-ai-hint="user avatar" /></Avatar>}
                    <div
                    className={cn(
                        "max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2",
                        msg.sender.id === currentUser?.id
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
                    <Input 
                        placeholder="Type a message..." 
                        className="pr-20" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        disabled={isSending}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <Button variant="ghost" size="icon" disabled={isSending}>
                            <Smile className="h-5 w-5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleSendMessage} disabled={isSending || !newMessage.trim()}>
                            <Send className="h-5 w-5 text-primary" />
                        </Button>
                    </div>
                </div>
            </div>
          </>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-16 w-16 mb-4" />
                <h3 className="text-xl font-semibold">Select a conversation</h3>
                <p>Choose a chat from the left or start a new one.</p>
            </div>
        )}
      </div>
    </div>
    </>
  );
}
