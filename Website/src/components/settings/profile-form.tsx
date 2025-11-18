"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from '@/lib/types';

interface ProfileFormProps {
  profile: UserProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveChanges = async () => {
    // Validate bio length
    if (bio.length > 500) {
      toast({
        variant: "destructive",
        title: "Bio Too Long",
        description: "Bio cannot exceed 500 characters. Current length: " + bio.length,
      });
      return;
    }
    
    // Validate display name
    if (displayName.trim().length < 3) {
      toast({
        variant: "destructive",
        title: "Invalid Display Name",
        description: "Display name must contain at least 3 non-whitespace characters.",
      });
      return;
    }
    
    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        username: username,
        bio: bio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: error.message,
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      // Refresh the page to show the new data and update user session if needed
      router.refresh();
    }

    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your public profile information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <Button onClick={handleSaveChanges} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  );
}
