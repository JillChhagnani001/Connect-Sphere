"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { BrandLogo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "verifying" | "ready" | "error";

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <BrandLogo size="lg" />
              </div>
              <CardTitle className="text-2xl">Update Your Password</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
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

  useEffect(() => {
    let isMounted = true;

    async function verifyResetToken() {
      try {
        const supabase = createClient();
        
        // Get token and type from URL parameters
        const token = searchParams.get("token");
        const type = searchParams.get("type");

        // If we have a recovery token, verify it
        if (token && type === "recovery") {
          if (isMounted) setStatus("verifying");

          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "recovery",
          });

          if (error) {
            if (isMounted) {
              setStatus("error");
              toast({
                variant: "destructive",
                title: "Invalid Link",
                description: "This password reset link is invalid or has expired. Please request a new one.",
              });
              setTimeout(() => router.push("/forgot-password"), 2000);
            }
            return;
          }

          if (isMounted) setStatus("ready");
          return;
        }

        // Check if user already has a valid session (e.g., clicked link again)
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          if (isMounted) setStatus("ready");
          return;
        }

        // No token and no session - redirect to forgot password
        if (isMounted) {
          toast({
            variant: "destructive",
            title: "No Reset Token",
            description: "Please request a password reset link.",
          });
          router.push("/forgot-password");
        }
      } catch (error) {
        if (isMounted) {
          setStatus("error");
          toast({
            variant: "destructive",
            title: "Error",
            description: "An error occurred. Please try again.",
          });
          setTimeout(() => router.push("/forgot-password"), 2000);
        }
      }
    }

    verifyResetToken();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router, toast]);

  const isFormDisabled = status !== "ready";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <BrandLogo size="lg" />
          </div>
          <CardTitle className="text-2xl">Update Your Password</CardTitle>
          <CardDescription>
            {status === "checking" && "Checking reset link..."}
            {status === "verifying" && "Verifying reset link..."}
            {status === "ready" && "Enter your new password below."}
            {status === "error" && "Invalid or expired link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "error" ? (
            <p className="text-center text-sm text-muted-foreground">
              Redirecting to password reset page...
            </p>
          ) : (
            <UpdatePasswordForm disabled={isFormDisabled} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
