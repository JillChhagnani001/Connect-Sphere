"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import type { UserProfile } from "@/lib/types";
import { useDebounce } from 'use-debounce';

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChatStarted: (userId: string) => void;
}

export function NewChatDialog({ isOpen, onClose, onChatStarted }: NewChatDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useUser();

  useEffect(() => {
    if (debouncedSearchTerm.length > 1) {
      performSearch(debouncedSearchTerm);
    } else {
      setResults([]);
    }
  }, [debouncedSearchTerm]);

  const performSearch = async (query: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .not('id', 'eq', currentUser.id)
        .limit(10);
      
      if (error) throw error;
      setResults(data || []);
    } catch (e) {
      console.error("Error searching users:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    onChatStarted(userId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Search for a user to start a conversation.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Search by username or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ScrollArea className="h-72 mt-4">
            <div className="space-y-2">
              {loading && <p className="text-muted-foreground text-center">Searching...</p>}
              {!loading && results.length === 0 && debouncedSearchTerm.length > 1 && (
                <p className="text-muted-foreground text-center">No users found.</p>
              )}
              {results.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted"
                  onClick={() => handleUserSelect(user.id)}
                >
                  <Avatar>
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{user.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{user.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}