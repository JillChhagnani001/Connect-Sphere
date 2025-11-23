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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormProps = {
  onSuccess?: () => void;
};

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps = {}) {
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const supabase = createClient();
      
      // Get the current origin
      const origin = typeof window !== "undefined" 
        ? window.location.origin 
        : "http://localhost:9002";
      
      // Construct the redirect URL
      const redirectTo = `${origin}/update-password`;
      
      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        return;
      }
      
      // Show success state
      setIsSuccess(true);
      form.reset();
      
      toast({
        title: "Email Sent",
        description: "Check your email for a password reset link.",
      });
      
      onSuccess?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    }
  }

  if (isSuccess) {
    return (
      <Alert>
        <AlertDescription>
          We&apos;ve sent a password reset link to your email. Please check your inbox and follow the instructions.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  placeholder="name@example.com" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full" 
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>
    </Form>
  );
}
