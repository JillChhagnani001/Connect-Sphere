import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivacySettings } from "@/components/privacy/privacy-settings";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserProfile } from "@/lib/types";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // If for some reason the profile doesn't exist, provide sensible defaults
  const userProfile: UserProfile = profile || {
    id: user.id,
    display_name: 'User',
    username: 'user',
    bio: '',
    avatar_url: '',
    is_private: false,
    is_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <ProfileForm profile={userProfile} />
        
        <PrivacySettings userId={user.id} />
        
        <Card>
            <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Manage actions related to your account.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive">Delete Account</Button>
                <p className="text-sm text-muted-foreground mt-2">Permanently delete your ConnectSphere account and all of its content.</p>
            </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
