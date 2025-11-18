"use client";

import type { SVGProps } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SocialButtonsProps {
  readonly isSignup?: boolean;
}

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path fill="#EA4335" d="M12 10.2v3.92h5.54c-.24 1.41-.99 2.6-2.11 3.4l3.41 2.65c1.99-1.84 3.15-4.56 3.15-7.78 0-.75-.07-1.47-.2-2.16H12Z" />
      <path fill="#34A853" d="M6.55 14.32 5.59 15.1l-2.72 2.1C4.78 19.88 8.17 21.9 12 21.9c2.7 0 4.97-.9 6.63-2.44l-3.41-2.65c-.92.62-2.1.99-3.22.99-2.48 0-4.6-1.67-5.35-3.98Z" />
      <path fill="#FBBC05" d="M2.87 6.8A9.89 9.89 0 0 0 2.1 10c0 1.14.2 2.24.56 3.2A9.93 9.93 0 0 0 6.55 14.3l2.2-1.71c-.52-1.55-.52-3.32 0-4.87l-2.2-1.71Z" />
      <path fill="#4285F4" d="M12 4.58c1.47 0 2.8.5 3.85 1.48l2.89-2.89C17 1.7 14.7.8 12 .8 8.17.8 4.78 2.82 2.87 6.8L6.55 8.6C7.3 6.29 9.52 4.58 12 4.58Z" />
    </svg>
  );
}

export function SocialButtons({ isSignup }: Readonly<SocialButtonsProps>) {
  const supabase = createClient();

  const handleSignInWithGoogle = async () => {
    const redirectTo = `${globalThis.location.origin}/api/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo, // Your callback route
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or {isSignup ? "sign up" : "log in"} with
          </span>
        </div>
      </div>
      
      <Button variant="outline" className="w-full" onClick={handleSignInWithGoogle}>
        <GoogleIcon className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}