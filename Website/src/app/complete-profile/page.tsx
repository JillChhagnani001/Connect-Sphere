import { Logo } from "@/components/logo";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function CompleteProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if profile already exists and is complete
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (profile?.username) {
    // Profile is already complete
    redirect("/feed");
  }

  // Extract pre-filled data from user metadata
  const email = user.email || "";
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || "";
  const avatarUrl = user.user_metadata?.avatar_url || "";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center gap-2">
            <Logo className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">ConnectSphere</h1>
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Please choose a username to complete your account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompleteProfileForm
            email={email}
            defaultDisplayName={displayName}
            avatarUrl={avatarUrl}
            userId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
