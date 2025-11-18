"use client";

import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function LoginForm() {
  const { toast } = useToast();
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    } else {
      // Ensure a profile row exists for this user (email/password flow doesn't hit the OAuth callback)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (!profile) {
            const sanitize = (value?: string | null) =>
              (value || "")
                .toString()
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_\-]+/g, "-")
                .replace(/^-+|-+$/g, "");

            const emailLocal = user.email?.split('@')[0];
            const rawUsername = (user.user_metadata.user_name || user.user_metadata.username || user.user_metadata.preferred_username || user.user_metadata.full_name || emailLocal || `user-${user.id.slice(0, 6)}`) as string;
            const safeUsername = sanitize(rawUsername) || `user-${user.id.slice(0, 6)}`;
            const displayName = (user.user_metadata.full_name || user.user_metadata.name || user.user_metadata.display_name || emailLocal || "User");

            await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                username: safeUsername,
                display_name: displayName,
                avatar_url: user.user_metadata.avatar_url ?? null,
                bio: ''
              }, { onConflict: 'id' });
        }
      }
      toast({
        title: "Logged In!",
        description: "Redirecting you to the feed.",
      });
      // A full page reload is more reliable for ensuring the server-side session is updated.
      location.href = '/feed';
    }
  }

  const handleForgotPasswordSuccess = () => {
    setResetEmailSent(true);
    setIsForgotPasswordOpen(false);
  };

  return (
    <Form {...form}>
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter the email associated with your account and we&apos;ll send reset instructions.
            </DialogDescription>
          </DialogHeader>
          <ForgotPasswordForm onSuccess={handleForgotPasswordSuccess} />
        </DialogContent>
      </Dialog>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {resetEmailSent && (
          <Alert>
            <AlertDescription>
              We&apos;ve sent a password reset link. Please check your inbox and follow the instructions.
            </AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
                <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                        Forgot password?
                    </button>
                </div>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full text-lg py-6" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
    </Form>
  );
}
