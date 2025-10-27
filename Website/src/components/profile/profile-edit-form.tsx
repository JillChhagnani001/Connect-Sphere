"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { getBucketOrThrow } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

interface ProfileEditFormProps {
  user: UserProfile;
  onSave: (updatedUser: UserProfile) => void;
  onCancel: () => void;
}

export function ProfileEditForm({ user, onSave, onCancel }: ProfileEditFormProps) {
  const [formData, setFormData] = useState({
    display_name: user.display_name || '',
    username: user.username || '',
    bio: user.bio || '',
    email: user.email || '',
    phone: user.phone || '',
    website: user.website || '',
    location: user.location || '',
    is_private: user.is_private || false,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar_url || '');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const bucket = getBucketOrThrow('avatars');
    const filePath = `${bucket}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      if ((uploadError as any)?.name === 'StorageApiError') {
        throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage or set NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET env.`);
      }
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Debug: Check if user is authenticated
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      console.log('Current user:', currentUser);
      console.log('Auth error:', authError);
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      let avatarUrl = user.avatar_url;

      // Upload new avatar if selected
      if (avatarFile) {
        console.log('Uploading avatar...');
        avatarUrl = await uploadAvatar(avatarFile);
        console.log('Avatar uploaded:', avatarUrl);
      }

      // Debug: Check if profiles table exists and is accessible
      console.log('Checking profiles table...');
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      console.log('Test query result:', testData);
      console.log('Test query error:', testError);

      if (testError) {
        throw new Error(`Database error: ${JSON.stringify(testError)}`);
      }

      // First, check what columns exist in the profiles table
      console.log('Checking existing profile...');
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Existing profile:', existingProfile);
      console.log('Fetch error:', fetchError);

      // Build update object with only basic fields that are likely to exist
      const updateData = {
        display_name: formData.display_name,
        username: formData.username,
        bio: formData.bio,
        avatar_url: avatarUrl,
      };

      // Only add fields that exist in the current schema
      if (existingProfile) {
        // Check which fields exist and add them conditionally
        if ('email' in existingProfile) updateData.email = formData.email;
        if ('phone' in existingProfile) updateData.phone = formData.phone;
        if ('website' in existingProfile) updateData.website = formData.website;
        if ('location' in existingProfile) updateData.location = formData.location;
        if ('is_private' in existingProfile) updateData.is_private = formData.is_private;
        if ('updated_at' in existingProfile) updateData.updated_at = new Date().toISOString();
      }

      console.log('Updating profile with data:', updateData);

      let { data: updateResult, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select();

      console.log('Update result:', updateResult);
      console.log('Update error:', error);

      // If update fails, try to insert (in case profile doesn't exist)
      if (error && error.code === 'PGRST116') {
        console.log('Profile not found, creating new profile...');
        
        // Build insert object with only basic fields
        const insertData = {
          id: user.id,
          display_name: formData.display_name,
          username: formData.username,
          bio: formData.bio,
          avatar_url: avatarUrl,
        };

        // Only add fields that are likely to exist in a basic profiles table
        if (existingProfile) {
          if ('email' in existingProfile) insertData.email = formData.email;
          if ('phone' in existingProfile) insertData.phone = formData.phone;
          if ('website' in existingProfile) insertData.website = formData.website;
          if ('location' in existingProfile) insertData.location = formData.location;
          if ('is_private' in existingProfile) insertData.is_private = formData.is_private;
          if ('created_at' in existingProfile) insertData.created_at = new Date().toISOString();
          if ('updated_at' in existingProfile) insertData.updated_at = new Date().toISOString();
        }

        const { data: insertResult, error: insertError } = await supabase
          .from('profiles')
          .insert(insertData)
          .select();
        
        console.log('Insert result:', insertResult);
        console.log('Insert error:', insertError);
        
        if (insertError) {
          throw new Error(`Insert error: ${JSON.stringify(insertError)}`);
        }
      } else if (error) {
        throw new Error(`Update error: ${JSON.stringify(error)}`);
      }

      const updatedUser: UserProfile = {
        ...user,
        ...formData,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      onSave(updatedUser);
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      console.error('Error type:', typeof error);
      console.error('Error stringified:', JSON.stringify(error, null, 2));
      
      // More detailed error message
      let errorMessage = "Failed to update profile. Please try again.";
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `Error: ${error.message}`;
      } else if (error && typeof error === 'string') {
        errorMessage = `Error: ${error}`;
      } else if (error) {
        errorMessage = `Error: ${JSON.stringify(error)}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
        <CardDescription>Update your profile information and privacy settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview} alt="Profile" />
              <AvatarFallback>{formData.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90"
            >
              <Camera className="h-4 w-4" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Click the camera icon to change your profile picture
          </p>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => handleInputChange('display_name', e.target.value)}
              placeholder="Enter your display name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="Enter your username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
          />
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="your.email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="City, Country"
              />
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Privacy Settings</h3>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h4 className="font-medium">Private Account</h4>
              <p className="text-sm text-muted-foreground">
                When your account is private, only people you approve can see your posts and profile.
              </p>
            </div>
            <Switch
              checked={formData.is_private}
              onCheckedChange={(checked) => handleInputChange('is_private', checked)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
