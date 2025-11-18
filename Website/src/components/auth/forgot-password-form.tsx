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
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

type ForgotPasswordFormProps = {
  onSuccess?: () => void;
};

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
});

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps = {}) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const supabase = createClient();
    const originFromEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const globalWithWindow =
      typeof globalThis === "object" && "window" in globalThis
        ? (globalThis as typeof globalThis & { window?: Window })
        : undefined;
    const originFromWindow = globalWithWindow?.window?.location.origin;
    const redirectOrigin = originFromEnv || originFromWindow;
    const redirectTo = redirectOrigin
      ? `${redirectOrigin.replace(/\/$/, "")}/update-password`
      : undefined;
    // By not providing a redirectTo, Supabase will use the Site URL from your project settings.
    const { error } = await supabase.auth.resetPasswordForEmail(
      values.email,
      redirectTo ? { redirectTo } : undefined
    );

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email for a link to reset your password.",
      });
      onSuccess?.();
    }
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
                <Input placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full text-lg py-6" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>
    </Form>
  );
}
