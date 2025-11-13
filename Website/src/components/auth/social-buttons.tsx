"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FaGoogle, FaGithub } from "react-icons/fa"; // Using react-icons for logos

interface SocialButtonsProps {
  isSignup?: boolean;
}

export function SocialButtons({ isSignup }: SocialButtonsProps) {
  const supabase = createClient();

  const handleSignInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`, // Your callback route
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
        <FaGoogle className="mr-2 h-4 w-4" />
        Continue with Google
      </Button>
    </div>
  );
}