"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const formSchema = z.object({
  display_name: z
    .string()
    .min(3, { message: "Display name must be at least 3 characters." })
    .refine((val) => val.trim().length >= 3, {
      message: "Display name must contain at least 3 non-whitespace characters.",
    }),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters." })
    .regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores."),
  email: z.string().email({ message: "Please enter a valid email address." }),
});

interface CompleteProfileFormProps {
  email: string;
  defaultDisplayName: string;
  avatarUrl: string;
  userId: string;
}

// Helper to generate a suggested username from display name
const generateSuggestedUsername = (displayName: string) => {
  return displayName
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
};

export function CompleteProfileForm({
  email,
  defaultDisplayName,
  avatarUrl,
  userId,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const suggestedUsername = generateSuggestedUsername(defaultDisplayName);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      display_name: defaultDisplayName,
      username: suggestedUsername,
      email: email,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Check for existing username
      const { data: existingUser, error: checkError } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", values.username)
        .single();

      if (existingUser || !checkError) {
        toast({
          variant: "destructive",
          title: "Username Taken",
          description: "This username is already taken. Please choose another one.",
        });
        setIsSubmitting(false);
        return;
      }

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", userId)
        .single();

      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            username: values.username,
            display_name: values.display_name,
            avatar_url: avatarUrl || existingProfile.avatar_url || null,
          })
          .eq("id", userId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            username: values.username,
            display_name: values.display_name,
            avatar_url: avatarUrl || null,
            bio: "",
          });

        if (insertError) {
          throw insertError;
        }

        // Create privacy settings
        const { error: privacyError } = await supabase
          .from("privacy_settings")
          .insert({
            user_id: userId,
          });

        if (privacyError) {
          console.error("Error creating privacy settings:", privacyError);
          // Don't block the flow if privacy settings fail
        }
      }

      toast({
        title: "Profile Completed!",
        description: "Welcome to ConnectSphere!",
      });

      // Hard redirect to ensure server picks up the new profile
      location.href = "/feed";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to complete profile. Please try again.",
      });
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} disabled className="bg-muted" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="Your Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="yourusername" {...field} />
              </FormControl>
              <p className="text-sm text-muted-foreground">
                Lowercase letters, numbers, and underscores only
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full text-lg py-6 mt-6"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Completing profile..." : "Complete Profile"}
        </Button>
      </form>
    </Form>
  );
}
