
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Smile, ArrowLeft, MoreHorizontal, Plus, MessageSquare, Image as ImageIcon, X, UserRound, Trash2, Ban, Undo2, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import type { Conversation, Message, UserProfile } from "@/lib/types";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "../ui/skeleton";
import { NewChatDialog } from "./new-chat-dialog";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type EnrichedConversation = Omit<Conversation, 'participants'> & {
  participants: { data: UserProfile[] };
  other_participant: UserProfile;
  is_blocked_by_me: boolean;
  has_blocked_me: boolean;
};

const CONVERSATION_SKELETON_KEYS = [
  "chat-placeholder-1",
  "chat-placeholder-2",
  "chat-placeholder-3",
  "chat-placeholder-4",
  "chat-placeholder-5",
  "chat-placeholder-6",
];

const MESSAGE_DATE_KEY_FORMAT = "yyyy-MM-dd";

const formatDateLabel = (timestamp: Date) => {
  if (isToday(timestamp)) return "Today";
  if (isYesterday(timestamp)) return "Yesterday";
  return format(timestamp, "dd MMM yyyy");
};

const formatMessageTime = (timestamp: Date) => format(timestamp, "hh:mm a");
const PREVIEW_MAX_LENGTH = 72;

type MessageTimelineEntry =
  | { kind: "date"; key: string; label: string }
  | { kind: "message"; key: string; message: Message };

export function ChatLayout() {
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<EnrichedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(() => {
    // Initialize chat visibility based on URL params
    const win = (globalThis as { window?: Window }).window;
    if (win) {
      const params = new URLSearchParams(win.location.search);
      return params.has('userId') || params.has('conversationId');
    }
    return false;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isConversationActionPending, setIsConversationActionPending] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user: currentUser, profile: currentUserProfile } = useUser();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getOtherParticipant = useCallback((convo: EnrichedConversation | null, currentUserId: string) => {
    if (!convo) return undefined;

    const participants = Array.isArray(convo.participants?.data) ? convo.participants.data : [];
    const others = participants.filter((p) => p && p.id !== currentUserId);
    if (others.length > 0) {
      return others[0];
    }

    if (convo.other_participant && convo.other_participant.id !== currentUserId) {
      return convo.other_participant;
    }

    return participants[0];
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

  const fetchConversations = useCallback(async (options?: { silent?: boolean }) => {
    if (!currentUser?.id) {
      return [] as EnrichedConversation[];
    }

    const showSpinner = !options?.silent;
    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      const response = await fetch("/api/messages/conversations", {
        method: "GET",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = payload?.error ?? "Could not fetch conversations.";
        throw new Error(errorMessage);
      }

      const list = (Array.isArray(payload?.conversations) ? payload.conversations : []) as EnrichedConversation[];
      setConversations(list);
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return list.find((c) => c.id === prev.id) ?? prev;
      });
      return list;
    } catch (error: any) {
      console.error("Error fetching conversations:", error);

      if (!options?.silent) {
        const description = error?.message || error?.details || "Could not fetch conversations.";
        toast({ title: "Error", description, variant: "destructive" });
        setConversations([]);
        setSelectedConversation(null);
      }

      return [] as EnrichedConversation[];
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }, [currentUser?.id, toast]);

  const clearConversationParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('userId');
    params.delete('conversationId');
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const removeConversationLocally = useCallback((conversationId: number) => {
    setConversations(prev => prev.filter(convo => convo.id !== conversationId));
  }, []);

  const updateConversationFlags = useCallback(
    (conversationId: number, updates: Partial<Pick<EnrichedConversation, "is_blocked_by_me" | "has_blocked_me">>) => {
      setConversations(prev =>
        prev.map(convo => (convo.id === conversationId ? { ...convo, ...updates } : convo))
      );
      setSelectedConversation(prev => (prev && prev.id === conversationId ? { ...prev, ...updates } : prev));
    },
  []);

  const resetAfterConversationRemoval = useCallback(() => {
    setSelectedConversation(null);
    setMessages([]);
    setIsChatVisible(false);
    clearConversationParams();
  }, [clearConversationParams]);

  const handleDeleteConversationForEveryone = useCallback(async () => {
    if (!selectedConversation) return;

    const conversationId = selectedConversation.id;
    const otherUser = currentUser ? getOtherParticipant(selectedConversation, currentUser.id) : null;

    setIsConversationActionPending(true);
    try {
      const response = await fetch(`/api/messages/conversations?conversationId=${conversationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload?.error ?? "Could not delete conversation.";
        throw new Error(message);
      }

      removeConversationLocally(conversationId);
      resetAfterConversationRemoval();
      await fetchConversations({ silent: true });

      const description = otherUser?.display_name
        ? `Conversation with ${otherUser.display_name} deleted.`
        : "Conversation deleted.";

      toast({ title: "Chat deleted", description });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      const description = error?.message || "Could not delete conversation.";
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsConversationActionPending(false);
    }
  }, [selectedConversation, currentUser, getOtherParticipant, removeConversationLocally, resetAfterConversationRemoval, fetchConversations, toast]);

  const handleHideConversationForMe = useCallback(async () => {
    if (!selectedConversation || !currentUser) return;

    const conversationId = selectedConversation.id;
    const otherUser = getOtherParticipant(selectedConversation, currentUser.id);

    setIsConversationActionPending(true);
    try {
      const response = await fetch("/api/messages/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, action: "hide" }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload?.error ?? "Could not clear chat.";
        throw new Error(message);
      }

      removeConversationLocally(conversationId);
      resetAfterConversationRemoval();
      await fetchConversations({ silent: true });

      const description = otherUser?.display_name
        ? `${otherUser.display_name} will disappear until new messages arrive.`
        : "Chat cleared for you.";

      toast({ title: "Chat cleared", description });
    } catch (error: any) {
      console.error("Error clearing conversation:", error);
      const description = error?.message || "Could not clear chat.";
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsConversationActionPending(false);
    }
  }, [selectedConversation, currentUser, getOtherParticipant, removeConversationLocally, resetAfterConversationRemoval, fetchConversations, toast]);

  const handleDeleteMessage = useCallback(
    async (message: Message) => {
      if (!currentUser) {
        toast({ title: "Error", description: "You must be signed in to delete messages.", variant: "destructive" });
        return;
      }

      if (pendingDeleteMessageId === message.id) {
        return;
      }

      const messageId = message.id;
      const conversationId = selectedConversation?.id ?? message.conversation_id;
      const originalDeletedBy = Array.isArray(message.deleted_by) ? [...message.deleted_by] : [];
      const ensureSenderRecorded = originalDeletedBy.includes(currentUser.id)
        ? originalDeletedBy
        : [...originalDeletedBy, currentUser.id];

      setPendingDeleteMessageId(messageId);

      setMessages((prev) =>
        prev.map((entry) =>
          entry.id === messageId
            ? { ...entry, deleted_for_everyone: true, deleted_by: ensureSenderRecorded }
            : entry
        )
      );

      setConversations((prev) =>
        prev.map((convo) =>
          convo.id === conversationId
            ? {
                ...convo,
                last_message:
                  convo.last_message && convo.last_message.id === messageId
                    ? {
                        ...convo.last_message,
                        deleted_for_everyone: true,
                        deleted_by: ensureSenderRecorded,
                      }
                    : convo.last_message,
              }
            : convo
        )
      );

      setSelectedConversation((prev) => {
        if (prev && prev.last_message && prev.last_message.id === messageId) {
          return {
            ...prev,
            last_message: {
              ...prev.last_message,
              deleted_for_everyone: true,
              deleted_by: ensureSenderRecorded,
            },
          };
        }
        return prev;
      });

      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "delete-for-everyone" }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const messageText = payload?.error ?? "Could not delete message.";
          throw new Error(messageText);
        }
      } catch (error: any) {
        console.error("Error deleting message:", error);
        const description = error?.message || "Could not delete message.";
        toast({ title: "Error", description, variant: "destructive" });

        setMessages((prev) =>
          prev.map((entry) =>
            entry.id === messageId
              ? { ...entry, deleted_for_everyone: message.deleted_for_everyone, deleted_by: originalDeletedBy }
              : entry
          )
        );

        setConversations((prev) =>
          prev.map((convo) =>
            convo.id === conversationId
              ? {
                  ...convo,
                  last_message:
                    convo.last_message && convo.last_message.id === messageId
                      ? {
                          ...convo.last_message,
                          deleted_for_everyone: message.deleted_for_everyone,
                          deleted_by: originalDeletedBy,
                        }
                      : convo.last_message,
                }
              : convo
          )
        );

        setSelectedConversation((prev) => {
          if (prev && prev.last_message && prev.last_message.id === messageId) {
            return {
              ...prev,
              last_message: {
                ...prev.last_message,
                deleted_for_everyone: message.deleted_for_everyone,
                deleted_by: originalDeletedBy,
              },
            };
          }
          return prev;
        });
      } finally {
        setPendingDeleteMessageId((current) => (current === messageId ? null : current));
      }
    },
    [currentUser, pendingDeleteMessageId, selectedConversation?.id, toast]
  );

  const handleBlockUser = useCallback(async () => {
    if (!selectedConversation || !currentUser) return;

    if (selectedConversation.is_blocked_by_me) {
      toast({ title: "Already blocked", description: "You have already blocked this user." });
      return;
    }

    const otherUser = getOtherParticipant(selectedConversation, currentUser.id);
    if (!otherUser) {
      toast({ title: "Error", description: "Could not determine participant to block.", variant: "destructive" });
      return;
    }

    setIsConversationActionPending(true);
    try {
      const response = await fetch("/api/messages/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: otherUser.id }),
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload?.error ?? "Could not block user.";
        throw new Error(message);
      }

      updateConversationFlags(selectedConversation.id, { is_blocked_by_me: true, has_blocked_me: false });
      await fetchConversations({ silent: true });

      const description = otherUser.display_name
        ? `${otherUser.display_name} has been blocked.`
        : "User has been blocked.";

      toast({ title: "User blocked", description });
    } catch (error: any) {
      console.error("Error blocking user:", error);
      const description = error?.message || "Could not block user.";
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsConversationActionPending(false);
    }
  }, [selectedConversation, currentUser, getOtherParticipant, updateConversationFlags, fetchConversations, toast]);

  const handleUnblockUser = useCallback(async () => {
    if (!selectedConversation || !currentUser) return;

    if (!selectedConversation.is_blocked_by_me) {
      toast({ title: "Not blocked", description: "This user is not currently blocked." });
      return;
    }

    const otherUser = getOtherParticipant(selectedConversation, currentUser.id);
    if (!otherUser) {
      toast({ title: "Error", description: "Could not determine participant to unblock.", variant: "destructive" });
      return;
    }

    setIsConversationActionPending(true);
    try {
      const response = await fetch(`/api/messages/blocks?targetUserId=${otherUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload?.error ?? "Could not unblock user.";
        throw new Error(message);
      }

      updateConversationFlags(selectedConversation.id, { is_blocked_by_me: false });
      await fetchConversations({ silent: true });

      const description = otherUser.display_name
        ? `${otherUser.display_name} has been unblocked.`
        : "User has been unblocked.";

      toast({ title: "User unblocked", description });
    } catch (error: any) {
      console.error("Error unblocking user:", error);
      const description = error?.message || "Could not unblock user.";
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsConversationActionPending(false);
    }
  }, [selectedConversation, currentUser, getOtherParticipant, updateConversationFlags, fetchConversations, toast]);

  const handleViewProfile = useCallback((userProfile: UserProfile | null | undefined) => {
    if (!userProfile) {
      toast({ title: "Profile unavailable", description: "Could not open profile for this user.", variant: "destructive" });
      return;
    }

    if (userProfile.username) {
      router.push(`/profile/${userProfile.username}`);
      return;
    }

    toast({ title: "Profile unavailable", description: "This user does not have a profile username yet.", variant: "destructive" });
  }, [router, toast]);

  const handleSelectConversation = useCallback((convo: EnrichedConversation) => {
    setSelectedConversation(convo);
    setIsChatVisible(true);
    const otherUser = getOtherParticipant(convo, currentUser!.id);
    if (otherUser) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('userId', otherUser.id);
      newParams.set('conversationId', convo.id.toString());
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    }
  }, [currentUser, getOtherParticipant, pathname, router, searchParams]);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Error", description: "Please select an image file.", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Error", description: "Image size must be less than 10MB.", variant: "destructive" });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `chat-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;
        
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);
        
      return publicUrl;
      
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: "Error", description: "Could not upload image.", variant: "destructive" });
      return null;
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setIsEmojiPickerOpen(false);
  };

  const openConversationWithUser = useCallback(async (targetUserId: string) => {
    if (!currentUser) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not open conversation.");
      }

      const conversation = payload?.conversation as EnrichedConversation | undefined;
      if (!conversation) {
        throw new Error("Conversation data was not returned.");
      }

      setConversations((prev) => {
        const existingIndex = prev.findIndex((c) => c.id === conversation.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = conversation;
          return next;
        }
        return [conversation, ...prev];
      });

      const otherUser = conversation.other_participant;
      if (otherUser) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('userId', otherUser.id);
        newParams.set('conversationId', conversation.id.toString());
        router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
      }

      handleSelectConversation(conversation);

  // Refresh conversation list from server to keep metadata (timestamps, unread counts) accurate.
  await fetchConversations({ silent: true });
    } catch (e) {
      console.error("Error opening conversation:", e);
      const description = e instanceof Error ? e.message : "Could not open conversation.";
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, handleSelectConversation, toast, pathname, router, searchParams]);
  
  useEffect(() => {
    if (currentUser) {
      fetchConversations();
    }
  }, [currentUser, fetchConversations]);

  useRealtime({
    currentUserId: currentUser?.id,
    onConversationAdded: () => {
      fetchConversations({ silent: true });
    },
    onMessageInserted: (payload: any) => {
      const newRecord = payload?.new as { conversation_id?: number | null; id?: number | null };
      const convoId = Number(newRecord?.conversation_id);
      const messageId = Number(newRecord?.id);

      if (Number.isFinite(convoId) && selectedConversation && selectedConversation.id === convoId) {
        const supabase = createClient();
        void supabase
          .from("messages")
          .select("*, sender:profiles!messages_sender_fkey(*)")
          .eq("id", messageId)
          .single()
          .then(({ data: newMessage, error }) => {
            if (!error && newMessage) {
              setMessages(prev => [...prev, newMessage as Message]);
            }
          });
      }

      void fetchConversations({ silent: true });
    },
    onMessageUpdated: (payload: any) => {
      const updatedRecord = payload?.new as { conversation_id?: number | null; id?: number | null };
      const convoId = Number(updatedRecord?.conversation_id);
      const messageId = Number(updatedRecord?.id);

      if (!Number.isFinite(convoId) || !Number.isFinite(messageId)) {
        return;
      }

      const supabase = createClient();
      void supabase
        .from("messages")
        .select("*, sender:profiles!messages_sender_fkey(*)")
        .eq("id", messageId)
        .single()
        .then(({ data: updatedMessage, error }) => {
          if (error || !updatedMessage) {
            return;
          }

          setConversations((prev) =>
            prev.map((convo) =>
              convo.id === convoId
                ? {
                    ...convo,
                    last_message:
                      convo.last_message && convo.last_message.id === messageId
                        ? (updatedMessage as Message)
                        : convo.last_message,
                  }
                : convo
            )
          );

          if (selectedConversation && selectedConversation.id === convoId) {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === messageId ? (updatedMessage as Message) : msg))
            );

            setSelectedConversation((prev) => {
              if (prev && prev.last_message && prev.last_message.id === messageId) {
                return {
                  ...prev,
                  last_message: updatedMessage as Message,
                };
              }
              return prev;
            });
          }
        });
    },
  });

  useEffect(() => {
    if (currentUser && !isLoading && conversations.length > 0) {
      const targetUserId = searchParams.get('userId');
      const conversationIdParam = searchParams.get('conversationId');
      
      const currentMatchesUrl = selectedConversation && (
        (conversationIdParam && selectedConversation.id.toString() === conversationIdParam) ||
        (targetUserId && getOtherParticipant(selectedConversation, currentUser.id)?.id === targetUserId)
      );
      
      if (!currentMatchesUrl) {
        if (conversationIdParam) {
          const conversationId = Number.parseInt(conversationIdParam, 10);
          if (!Number.isNaN(conversationId)) {
            const existingConvo = conversations.find(c => c.id === conversationId);
            if (existingConvo) {
              handleSelectConversation(existingConvo);
              return;
            }
          }
        }
        
        if (targetUserId) {
          const existingConvo = conversations.find(c => {
            const other = getOtherParticipant(c, currentUser.id);
            return other?.id === targetUserId;
          });
          
          if (existingConvo) {
            handleSelectConversation(existingConvo);
          } else {
            openConversationWithUser(targetUserId);
          }
        }
      }
    }
  }, [searchParams, currentUser, isLoading, conversations, selectedConversation, openConversationWithUser, handleSelectConversation, getOtherParticipant]);

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
             // Instead of fetching all messages, just add the new one.
             const { data: newMessage, error } = await supabase
                .from("messages")
                .select("*, sender:profiles!messages_sender_fkey(*)")
                .eq("id", (payload.new as any).id)
                .single();
            if (!error && newMessage) {
               setMessages(prev => [...prev, newMessage as Message]);
            }
          }
        )
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          async (payload) => {
            const { data: updatedMessage, error } = await supabase
              .from("messages")
              .select("*, sender:profiles!messages_sender_fkey(*)")
              .eq("id", (payload.new as any).id)
              .single();

            if (!error && updatedMessage) {
              setMessages((prev) =>
                prev.map((msg) => (msg.id === (payload.new as any).id ? (updatedMessage as Message) : msg))
              );

              setSelectedConversation((prev) => {
                if (prev && prev.last_message && prev.last_message.id === (payload.new as any).id) {
                  return {
                    ...prev,
                    last_message: updatedMessage as Message,
                  };
                }
                return prev;
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  
  const handleSendMessage = async () => {
    if (!selectedConversation || !currentUser || !currentUserProfile) return;

    if (selectedConversation.is_blocked_by_me) {
      toast({ title: "Unblock to send", description: "You need to unblock this user before messaging.", variant: "destructive" });
      return;
    }

    if (selectedConversation.has_blocked_me) {
      toast({ title: "Message not delivered", description: "This user is not receiving your messages right now.", variant: "destructive" });
      return;
    }

    if (!newMessage.trim() && !selectedImage) {
      return;
    }
    
    setIsSending(true);
    try {
        const supabase = createClient();
        let imageUrl: string | null = null;

        if (selectedImage) {
          imageUrl = await uploadImageToStorage(selectedImage);
          if (!imageUrl && selectedImage) {
            setIsSending(false);
            return;
          }
        }

        const contentToSend = newMessage.trim() || "";
        const { error } = await supabase
          .from('messages')
          .insert({
            conversation_id: selectedConversation.id,
            sender: currentUser.id,
            content: contentToSend, // Can be empty string if only image
            image_url: imageUrl,
          })
          .select('id, conversation_id, sender, content, image_url, created_at')
          .single();
        
        if (error) {
          console.error('Insert error (messages):', error);
          const detail = (error as any)?.message || (error as any)?.details || (error as any)?.hint || JSON.stringify(error);
          toast({ title: 'Error', description: `Send failed: ${detail}`, variant: 'destructive' });
          return;
        }
        
        setNewMessage("");
        removeImage();
        // UI is also updated via realtime subscription
        
    } catch (e: any) {
        const errMsg = e?.message || e?.details || e?.hint || (typeof e === 'object' ? JSON.stringify(e) : String(e)) || 'Unknown error';
        console.error("Error sending message:", {
          message: e?.message,
          code: e?.code,
          details: e?.details,
          hint: e?.hint,
          full: e,
        });
        toast({ title: "Error", description: errMsg, variant: "destructive" });
    } finally {
        setIsSending(false);
    }
  };
  
  const currentParticipant = selectedConversation && currentUser ? getOtherParticipant(selectedConversation, currentUser.id) : null;
  const conversationBlockedByMe = selectedConversation?.is_blocked_by_me ?? false;
  const conversationBlockedMe = selectedConversation?.has_blocked_me ?? false;
  const isMessagingDisabled = conversationBlockedByMe || conversationBlockedMe;

  useEffect(() => {
    if (isMessagingDisabled) {
      setIsEmojiPickerOpen(false);
    }
  }, [isMessagingDisabled]);

  const messageTimeline = useMemo<MessageTimelineEntry[]>(() => {
    const timeline: MessageTimelineEntry[] = [];
    let lastDateKey: string | null = null;

    for (const msg of messages) {
      const createdAt = new Date(msg.created_at);
      const dateKey = format(createdAt, MESSAGE_DATE_KEY_FORMAT);

      if (dateKey !== lastDateKey) {
        timeline.push({
          kind: "date",
          key: `date-${dateKey}`,
          label: formatDateLabel(createdAt),
        });
        lastDateKey = dateKey;
      }

      timeline.push({
        kind: "message",
        key: `message-${msg.id}-${msg.created_at}`,
        message: msg,
      });
    }

    return timeline;
  }, [messages]);

  const currentUserId = currentUser?.id ?? null;

  const getConversationPreviewText = useCallback(
    (convo: EnrichedConversation) => {
      const lastMessage = (convo.last_message ?? null) as Message | null;
      if (!lastMessage) {
        return "";
      }

      const deletedBy = Array.isArray((lastMessage as any).deleted_by)
        ? ((lastMessage as any).deleted_by as string[])
        : [];

      const deletedForEveryone = Boolean((lastMessage as any).deleted_for_everyone);

      if (deletedForEveryone) {
        return lastMessage.sender?.id === currentUserId ? "You deleted this message" : "This message was deleted";
      }

      if (currentUserId && deletedBy.includes(currentUserId)) {
        return "You deleted this message";
      }

      const content = (lastMessage.content ?? "").trim();
      let preview = content;

      if (lastMessage.image_url) {
        preview = content || "Image";
      }

      if (preview.length > PREVIEW_MAX_LENGTH) {
        const sliceEnd = Math.max(PREVIEW_MAX_LENGTH - 3, 0);
        return `${preview.slice(0, sliceEnd).trimEnd()}...`;
      }

      return preview;
    },
    [currentUserId]
  );

  if (isLoading && conversations.length === 0) {
     return (
       <div className="flex h-full border rounded-lg bg-card overflow-hidden">
         <div className="w-full md:w-1/3 border-r p-4 space-y-2">
      {CONVERSATION_SKELETON_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-3 p-3">
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

  return (
    <>
    <AlertDialog open={isBlockConfirmOpen} onOpenChange={setIsBlockConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {`Block ${currentParticipant?.display_name ?? "this user"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Blocking will prevent both of you from exchanging messages or seeing each other's updates.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConversationActionPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isConversationActionPending}
            onClick={() => {
              setIsBlockConfirmOpen(false);
              handleBlockUser();
            }}
          >
            Block user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
               {(() => {
                 const conversationsToShow = [...conversations];
                 if (selectedConversation && !conversations.some(c => c.id === selectedConversation.id)) {
                   conversationsToShow.unshift(selectedConversation);
                 }
                 
                 return conversationsToShow.length === 0 ? (
                   <div className="text-center text-muted-foreground py-16">
                     <p className="mb-2">No conversations yet.</p>
                     <Button onClick={() => setIsNewChatOpen(true)}>Start a new chat</Button>
                   </div>
                 ) : conversationsToShow.map((convo) => {
                if (!currentUser) return null;
                const otherUser = getOtherParticipant(convo, currentUser.id);
                if (!otherUser) return null;
                const previewText = getConversationPreviewText(convo);
                const showImageIcon = Boolean(convo.last_message?.image_url);
                return (
                  <button
                    key={convo.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                      "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                      <p className="text-sm text-muted-foreground">
                        {showImageIcon ? (
                          <span className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            <span className="truncate">{previewText}</span>
                          </span>
                        ) : (
                          <span className="block truncate">{previewText}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end text-xs text-muted-foreground">
                      <span>{convo.last_message ? formatDistanceToNow(new Date(convo.last_message.created_at), { addSuffix: true }) : ''}</span>
                      {convo.unread_count > 0 && (
                        <span className="mt-1 w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                          {convo.unread_count}
                        </span>
                      )}
                      {convo.is_blocked_by_me && (
                        <Badge variant="outline" className="mt-1">
                          Blocked
                        </Badge>
                      )}
                      {convo.has_blocked_me && !convo.is_blocked_by_me && (
                        <Badge variant="destructive" className="mt-1">
                          Blocked You
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              });
              })()}
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{currentParticipant.display_name}</h3>
                      {conversationBlockedByMe && (
                        <Badge variant="outline" className="uppercase tracking-wide">Blocked</Badge>
                      )}
                      {conversationBlockedMe && !conversationBlockedByMe && (
                        <Badge variant="destructive" className="uppercase tracking-wide">Blocked You</Badge>
                      )}
                    </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isConversationActionPending}>
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem className="gap-2" onSelect={() => handleViewProfile(currentParticipant)}>
                      <UserRound className="h-4 w-4" />
                      <span>View profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      disabled={isConversationActionPending}
                      onSelect={() => handleHideConversationForMe()}
                    >
                      <Eraser className="h-4 w-4" />
                      <span>Clear chat</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      disabled={isConversationActionPending}
                      onSelect={() => handleDeleteConversationForEveryone()}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete for everyone</span>
                    </DropdownMenuItem>
                    {conversationBlockedByMe ? (
                      <DropdownMenuItem
                        className="gap-2"
                        disabled={isConversationActionPending}
                        onSelect={() => handleUnblockUser()}
                      >
                        <Undo2 className="h-4 w-4" />
                        <span>Unblock user</span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="gap-2"
                        disabled={isConversationActionPending}
                        onSelect={() => {
                          setTimeout(() => setIsBlockConfirmOpen(true), 0);
                        }}
                      >
                        <Ban className="h-4 w-4" />
                        <span>Block user</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {isMessagingDisabled && (
              <div className="border-b bg-muted/40">
                <div className="px-4 py-3">
                  <Alert className="border-none bg-transparent p-0">
                    <AlertTitle>
                      {conversationBlockedByMe ? "You blocked this user" : "Messages won’t deliver"}
                    </AlertTitle>
                    <AlertDescription>
                      {conversationBlockedByMe ? (
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <p className="text-sm text-muted-foreground">
                            Unblock to start sending messages and allow profile visibility again.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnblockUser()}
                            disabled={isConversationActionPending}
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            Unblock user
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          This user has blocked you. Messages and calls will not be delivered.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
            <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
                <div className="space-y-4">
        {messageTimeline.map((entry) => {
          if (entry.kind === "date") {
            return (
              <div key={entry.key} className="my-6 flex justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {entry.label}
                </span>
              </div>
            );
          }

          const msg = entry.message;
          const createdAt = new Date(msg.created_at);
          const timeLabel = formatMessageTime(createdAt);
          const isOwnMessage = msg.sender?.id === currentUser?.id;

          const deletedBy = Array.isArray((msg as any).deleted_by) ? ((msg as any).deleted_by as string[]) : [];
          const messageDeletedForEveryone = Boolean((msg as any).deleted_for_everyone);
          const messageDeletedForUser = messageDeletedForEveryone
            ? isOwnMessage
            : currentUser?.id
            ? deletedBy.includes(currentUser.id)
            : false;
          const showImage = Boolean(msg.image_url) && !messageDeletedForEveryone && !messageDeletedForUser;
          const hasContent = Boolean((msg.content ?? "").trim());
          let displayText = hasContent ? msg.content : "";

          if (messageDeletedForEveryone) {
            displayText = isOwnMessage ? "You deleted this message" : "This message was deleted";
          } else if (messageDeletedForUser) {
            displayText = "You deleted this message";
          }

          const widthClass = showImage
            ? "max-w-sm md:max-w-md lg:max-w-lg"
            : "max-w-xs md:max-w-md lg:max-w-lg";
          const toneClass = messageDeletedForEveryone || messageDeletedForUser
            ? "bg-muted text-muted-foreground border border-dashed border-muted-foreground/50"
            : isOwnMessage
            ? "bg-primary text-primary-foreground"
            : "bg-muted";

          return (
            <div
              key={entry.key}
              className={cn(
                "group flex items-end gap-2",
                isOwnMessage ? "justify-end" : "justify-start"
              )}
            >
              {!isOwnMessage && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={msg.sender?.avatar_url} data-ai-hint="user avatar" />
                  <AvatarFallback>{msg.sender?.display_name?.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "flex items-center gap-1",
                  isOwnMessage ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn("rounded-lg px-4 py-2", widthClass, toneClass)}>
                  {showImage && (
                    <div className="overflow-hidden rounded-lg">
                      <a
                        href={msg.image_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={msg.image_url!}
                          alt="Message attachment"
                          className="h-auto w-full rounded-lg object-contain"
                          style={{ maxHeight: "500px", minHeight: "150px" }}
                          loading="lazy"
                          onError={(e) => {
                            console.error("Failed to load image:", msg.image_url);
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </a>
                    </div>
                  )}
                  {displayText && (
                    <p
                      className={cn(
                        showImage ? "mt-2" : "",
                        (messageDeletedForEveryone || messageDeletedForUser) && "italic"
                      )}
                    >
                      {displayText}
                    </p>
                  )}
                  {!displayText && !showImage && (messageDeletedForEveryone || messageDeletedForUser) && (
                    <p className="italic">
                      {messageDeletedForEveryone && !isOwnMessage ? "This message was deleted" : "You deleted this message"}
                    </p>
                  )}
                  <div
                    className={cn(
                      "mt-2 flex justify-end text-[11px] leading-none",
                      messageDeletedForUser
                        ? "text-muted-foreground/70"
                        : messageDeletedForEveryone || messageDeletedForUser
                        ? "text-muted-foreground/70"
                        : isOwnMessage
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground/80"
                    )}
                  >
                    {timeLabel}
                  </div>
                </div>
                {isOwnMessage && !(messageDeletedForEveryone || messageDeletedForUser) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground transition-opacity duration-150 hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    onClick={() => handleDeleteMessage(msg)}
                    disabled={pendingDeleteMessageId === msg.id}
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
                </div>
            </ScrollArea>
            <div className="p-4 border-t bg-card">
                {imagePreview && (
                  <div className="mb-2 relative inline-block">
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="relative">
                    <Input 
                        placeholder="Type a message..." 
                        className="pr-24" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        disabled={isSending || isMessagingDisabled}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          disabled={isSending || isMessagingDisabled}
                          onClick={() => fileInputRef.current?.click()}
                          type="button"
                          title="Upload image"
                        >
                            <ImageIcon className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={isSending || isMessagingDisabled} 
                              type="button"
                              title="Add emoji"
                            >
                              <Smile className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="end" side="top" sideOffset={8}>
                            <EmojiPicker 
                              onEmojiClick={onEmojiClick}
                              width={350}
                              height={400}
                            />
                          </PopoverContent>
                        </Popover>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={handleSendMessage} 
                          disabled={
                            isSending ||
                            isMessagingDisabled ||
                            (!newMessage.trim() && !selectedImage)
                          }
                          title="Send message"
                        >
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

    