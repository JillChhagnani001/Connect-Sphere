// src/components/privacy/privacy-settings.tsx

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Shield, Eye, Users, Lock, Globe, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PrivacySettingsProps {
  userId: string;
  onSettingsUpdate?: () => void;
}

// --- ✨ BACK TO ORIGINAL INTERFACE (Matches your DB) ---
interface PrivacySettings {
  profile_visibility: 'public' | 'followers' | 'private';
  post_visibility: 'public' | 'followers' | 'private';
  show_online_status: boolean;
  allow_follow_requests: boolean;
  allow_direct_messages: 'everyone' | 'followers' | 'none';
  show_followers: boolean;
  show_following: boolean;
  allow_tagging: boolean;
  allow_mentions: 'everyone' | 'followers' | 'none';
}

export function PrivacySettings({ userId, onSettingsUpdate }: PrivacySettingsProps) {
  // --- ✨ BACK TO ORIGINAL STATE (Matches your DB) ---
  const [settings, setSettings] = useState<PrivacySettings>({
    profile_visibility: 'public',
    post_visibility: 'public',
    show_online_status: true,
    allow_follow_requests: true, 
    allow_direct_messages: 'everyone',
    show_followers: true,
    show_following: true,
    allow_tagging: true,
    allow_mentions: 'everyone',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPrivacySettings();
  }, [userId]);

  const fetchPrivacySettings = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // --- ✨ FIX: Using .select('*') again ---
      // This selects all columns that exist and won't fail
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*') 
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
      toast({
        title: "Error",
        description: "Failed to load privacy settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // This update function is the same as the original and works fine
  const updateSetting = async (key: keyof PrivacySettings, value: any) => {
    setIsSaving(true);
    
    let updatedSettings: Partial<PrivacySettings> = { [key]: value };
    let newLocalSettings: Partial<PrivacySettings> = { [key]: value };

    // This logic is from your original file and is correct
    if (key === 'profile_visibility') {
      if (value === 'private' || value === 'followers') {
        updatedSettings.allow_follow_requests = true;
        newLocalSettings.allow_follow_requests = true;
      } else {
        updatedSettings.allow_follow_requests = false;
        newLocalSettings.allow_follow_requests = false;
      }
    }
    
    if (key === 'allow_follow_requests') {
      if (value === true) {
        // You removed 'followers' so we'll just set to 'private'
        updatedSettings.profile_visibility = 'private';
        newLocalSettings.profile_visibility = 'private';
      } else {
        updatedSettings.profile_visibility = 'public';
        newLocalSettings.profile_visibility = 'public';
      }
    }
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: userId,
          ...updatedSettings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...newLocalSettings }));
      onSettingsUpdate?.();

      toast({
        title: "Settings updated",
        description: "Your privacy settings have been saved.",
      });
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      toast({
        title: "Error",
        description: "Failed to update privacy setting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'followers':
        return <Users className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getVisibilityDescription = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'Visible to everyone';
      case 'followers':
        return 'Visible to your followers only';
      case "private":
        return 'Visible to you only';
      default:
        return '';
    }
  };

  if (isLoading) {
    // ... (loading state is same)
  }

  // --- ✨ SIMPLIFIED UI ---
  // I removed "Default Post Visibility" and "Social Lists"
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Settings
          </CardTitle>
          <CardDescription>
            Control who can see your content and interact with you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Visibility */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Profile Visibility</Label>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {getVisibilityIcon(settings.profile_visibility)}
                <div>
                  <p className="font-medium">Profile Visibility</p>
                  <p className="text-sm text-muted-foreground">
                    {getVisibilityDescription(settings.profile_visibility)}
                  </p>
                </div>
              </div>
              <Select
                value={settings.profile_visibility}
                onValueChange={(value: 'public' | 'followers' | 'private') => 
                  updateSetting('profile_visibility', value)
                }
                disabled={isSaving}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Public
                    </div>
                  </SelectItem>
                  {/* I'm keeping 'followers' here since your DB has it
                      but you can remove it if you want */}
                  <SelectItem value="followers">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Followers
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Private
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* --- ✨ REMOVED: Default Post Visibility --- */}

          {/* Activity Status */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4" />
              <div>
                <p className="font-medium">Show Online Status</p>
                <p className="text-sm text-muted-foreground">
                  Let others see when you're active
                </p>
              </div>
            </div>
            <Switch
              checked={settings.show_online_status}
              onCheckedChange={(checked) => updateSetting('show_online_status', checked)}
              disabled={isSaving}
            />
          </div>

          {/* Follow Requests */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4" />
              <div>
                <p className="font-medium">Private Account</p>
                <p className="text-sm text-muted-foreground">
                  {settings.allow_follow_requests 
                    ? "Your account is private. New followers must be approved."
                    : "Your account is public. Anyone can follow you."
                  }
                </p>
              </div>
            </div>
            <Switch
              checked={settings.allow_follow_requests}
              onCheckedChange={(checked) => updateSetting('allow_follow_requests', checked)}
              disabled={isSaving}
            />
          </div>

          {/* Direct Messages */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Direct Messages</Label>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4" />
                <div>
                  <p className="font-medium">Who can message you</p>
                  <p className="text-sm text-muted-foreground">
                    Control who can send you direct messages
                  </p>
                </div>
              </div>
              <Select
                value={settings.allow_direct_messages}
                onValueChange={(value: 'everyone' | 'followers' | 'none') => 
                  updateSetting('allow_direct_messages', value)
                }
                disabled={isSaving}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="followers">Followers Only</SelectItem>
                  <SelectItem value="none">No One</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* --- ✨ REMOVED: Social Lists --- */}
          
          {/* --- ✨ KEPT: Mentions and Tagging (Matches your DB) --- */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Mentions & Tagging</Label>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-4 w-4" />
                <div>
                  <p className="font-medium">Allow Tagging</p>
                  <p className="text-sm text-muted-foreground">
                    Let others tag you in posts
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.allow_tagging}
                onCheckedChange={(checked) => updateSetting('allow_tagging', checked)}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Who can mention you</p>
                    <p className="text-sm text-muted-foreground">
                      Control who can mention you in posts
                    </p>
                  </div>
                </div>
                <Select
                  value={settings.allow_mentions}
                  onValueChange={(value: 'everyone' | 'followers' | 'none') => 
                    updateSetting('allow_mentions', value)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="followers">Followers Only</SelectItem>
                    <SelectItem value="none">No One</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}