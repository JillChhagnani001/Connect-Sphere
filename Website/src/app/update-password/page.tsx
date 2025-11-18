"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "verifying" | "ready";

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex items-center gap-2">
                    <Logo className="h-10 w-10 text-primary" />
                    <h1 className="text-3xl font-bold tracking-tight">ConnectSphere</h1>
                </div>
              <CardTitle className="text-2xl">Update Your Password</CardTitle>
              <CardDescription>Preparing your password reset session...</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-md border border-dashed border-muted-foreground/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Loading reset form...
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <UpdatePasswordPageContent />
    </Suspense>
  );
}

function UpdatePasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("checking");

  const code = searchParams.get("code");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function ensureSession() {
      if (code) {
        if (isMounted) {
          setStatus("verifying");
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!isMounted) return;
          toast({
            variant: "destructive",
            title: "Invalid link",
            description: "This password reset link is no longer valid. Please request a new one.",
          });
          router.replace("/login?error=Invalid password reset link.");
          return;
        }
        if (!isMounted) return;
        router.replace("/update-password");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      if (isMounted) {
        setStatus("ready");
      }
    }

    ensureSession();

    return () => {
      isMounted = false;
    };
  }, [code, router, toast]);

  const isFormDisabled = status !== "ready";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center gap-2">
                <Logo className="h-10 w-10 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">ConnectSphere</h1>
            </div>
          <CardTitle className="text-2xl">Update Your Password</CardTitle>
          <CardDescription>Enter a new password below to update your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFormDisabled && (
            <p className="rounded-md border border-dashed border-muted-foreground/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {status === "verifying" ? "Verifying reset link..." : "Preparing your password reset session..."}
            </p>
          )}
          <UpdatePasswordForm disabled={isFormDisabled} />
        </CardContent>
      </Card>
    </div>
  );
}
